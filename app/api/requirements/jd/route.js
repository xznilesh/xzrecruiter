import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sessionToken } from '@/lib/auth';
import { consumeRateLimit } from '@/lib/rate-limit';
import { jdAction, getRequirementContext } from '@/lib/jd';
import { analyzeJdServer, jdAiConfigured } from '@/lib/jd-ai-server';
import { createJdIdempotencyKey } from '@/lib/jd-ai.mjs';
import { JD_PROMPT_VERSION, JD_SCHEMA_VERSION, sanitizeJdText, validateAiRequirementOutput } from '@/lib/jd-contract.mjs';

import { mutationRequestIsTrusted } from '@/lib/request-security';
export const runtime='nodejs';
export const dynamic='force-dynamic';

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin}
function uuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))}
function statusFor(error){
  if(error==='unauthorized')return 401;
  if(error==='am_only')return 403;
  if(error?.endsWith?.('_not_found')||error==='job_not_found')return 404;
  if(error==='jd_ai_not_configured')return 503;
  if(error==='already_processing')return 409;
  if(error==='rate_limited')return 429;
  if(error==='invalid_workflow_transition'||error==='blocking_clarifications'||error==='hard_rules_need_confirmation'||error==='brief_not_ready_for_approval')return 422;
  if(error==='jd_text_too_large')return 413;
  return 400;
}
function responseError(error,status){
  return NextResponse.json({ok:false,error},{status:status||statusFor(error)});
}
function reviewStateFromHumanPayload(criteria=[],clarifications=[]){
  const blocking=(Array.isArray(clarifications)?clarifications:[]).some((x)=>Boolean(x?.blocking)&&!Boolean(x?.resolved));
  if(blocking)return 'NEEDS_CLARIFICATION';
  const hardPending=(Array.isArray(criteria)?criteria:[]).some((x)=>
    x?.kind==='HARD_REQUIREMENT' &&
    (x?.enforcement==='PROPOSED_REVIEW'||Boolean(x?.requiresAmConfirmation)) &&
    !Boolean(x?.amConfirmed)
  );
  return hardPending?'NEEDS_REVIEW':'READY_FOR_APPROVAL';
}

export async function GET(req){
  if(!sameOrigin(req))return responseError('invalid_origin',403);
  const jobId=req.nextUrl.searchParams.get('jobId')||'';
  if(!uuid(jobId))return responseError('invalid_job');
  const context=await getRequirementContext(jobId).catch(()=>null);
  if(!context)return responseError('requirement_context_unavailable',503);
  return NextResponse.json({...context,aiConfigured:jdAiConfigured()});
}

export async function POST(req){
  if(!sameOrigin(req))return responseError('invalid_origin',403);
  let body;
  try{body=await req.json()}catch{return responseError('invalid_json')}
  const action=String(body?.action||'');

  if(action==='ingestText'){
    const jobId=String(body?.jobId||'');
    const sourceType=String(body?.sourceType||'PASTED').toUpperCase();
    const raw=String(body?.text||'');
    if(!uuid(jobId))return responseError('invalid_job');
    if(!['PASTED','EXISTING'].includes(sourceType))return responseError('invalid_source_type');
    if(raw.length>120000)return responseError('jd_text_too_large',413);
    const text=sanitizeJdText(raw);
    if(text.length<20)return responseError('jd_text_too_short');
    const checksum=createHash('sha256').update(text).digest('hex');
    const prepared=await jdAction('prepareSource',{jobId,sourceType,originalText:text,checksum,sizeBytes:Buffer.byteLength(text,'utf8'),mimeType:'text/plain'}).catch(()=>null);
    if(!prepared?.ok)return responseError(prepared?.error||'jd_ingest_failed');
    return NextResponse.json(prepared);
  }

  if(action==='analyze'){
    const sourceId=String(body?.sourceId||'');
    if(!uuid(sourceId))return responseError('invalid_source');
    if(!jdAiConfigured())return responseError('jd_ai_not_configured',503);

    const sourceResult=await jdAction('sourceText',{sourceId}).catch(()=>null);
    if(!sourceResult?.ok)return responseError(sourceResult?.error||'jd_source_unavailable');
    const source=sourceResult.source||{};
    if(source.source_status!=='READY')return responseError('jd_source_not_ready');
    const token=await sessionToken();
    if(!token)return responseError('unauthorized',401);
    const rate=await consumeRateLimit({
      scope:'ai:jd_analysis',identity:token,limit:20,windowSeconds:600
    }).catch(()=>null);
    if(!rate?.allowed)return responseError(rate?.ok===false?'rate_limited':'jd_ai_rate_limit_unavailable',rate?.ok===false?429:503);
    const jdText=sanitizeJdText(source.extracted_text||source.original_text||'');
    if(jdText.length<20)return responseError('jd_text_too_short');

    const model=process.env.XZRECRUITER_JD_MODEL||'gpt-5.6-terra';
    const inputHash=createHash('sha256').update(jdText).digest('hex');
    const idempotencyKey=createJdIdempotencyKey({
      jobId:source.job_id,sourceId,jdText,promptVersion:JD_PROMPT_VERSION,schemaVersion:JD_SCHEMA_VERSION,
    });
    const begin=await jdAction('beginAiRun',{
      sourceId,idempotencyKey,model,promptVersion:JD_PROMPT_VERSION,schemaVersion:JD_SCHEMA_VERSION,inputHash,
    }).catch(()=>null);
    if(!begin?.ok)return responseError(begin?.error||'ai_run_prepare_failed');
    if(begin.reused&&begin.run_status==='SUCCEEDED'){
      const context=await getRequirementContext(source.job_id).catch(()=>null);
      return NextResponse.json({ok:true,reused:true,context});
    }
    if(begin.reused&&begin.run_status==='PROCESSING')return responseError('already_processing',409);

    try{
      const result=await analyzeJdServer({
        jdText,
        sourceMeta:{sourceType:source.source_type,version:source.version_number},
        model,
      });
      const completed=await jdAction('completeAiRun',{
        runId:begin.run_id,
        output:result.data,
        reviewState:result.reviewState,
        modelResolved:result.resolvedModel,
        providerResponseId:result.providerResponseId,
      });
      if(!completed?.ok)return responseError(completed?.error||'ai_run_finalize_failed');
      return NextResponse.json({ok:true,...completed,reviewState:result.reviewState});
    }catch(error){
      const code=String(error?.code||error?.message||'ai_analysis_failed').slice(0,120);
      await jdAction('completeAiRun',{
        runId:begin.run_id,output:{},reviewState:'NEEDS_REVIEW',errorCode:code,errorDetail:'AI execution failed; retry is safe.',
      }).catch(()=>null);
      console.error('jd_ai_analysis_failed',code);
      return responseError(code,code==='jd_ai_timeout'?504:503);
    }
  }

  if(action==='saveDraft'){
    const briefId=String(body?.briefId||'');
    if(!uuid(briefId))return responseError('invalid_brief');
    const payload={
      fields:body?.structuredData||{},
      criteria:Array.isArray(body?.criteria)?body.criteria:[],
      clarifications:Array.isArray(body?.clarifications)?body.clarifications:[],
      hiringBrief:body?.hiringBrief||{},
      searchBlueprint:body?.searchBlueprint||{},
      inputSafety:body?.inputSafety||{promptInjectionDetected:false,signals:[]},
    };
    const validation=validateAiRequirementOutput(payload);
    if(!validation.ok)return NextResponse.json({ok:false,error:'schema_validation_failed',details:validation.errors.slice(0,30)},{status:422});
    const reviewState=reviewStateFromHumanPayload(body?.criteria,body?.clarifications);
    const saved=await jdAction('saveBrief',{
      briefId,
      structuredData:validation.data.fields,
      hiringBrief:validation.data.hiringBrief,
      searchBlueprint:validation.data.searchBlueprint,
      criteria:body?.criteria||[],
      clarifications:body?.clarifications||[],
      reviewState,
      reason:String(body?.reason||'').slice(0,1000),
    }).catch(()=>null);
    if(!saved?.ok)return responseError(saved?.error||'brief_save_failed');
    return NextResponse.json(saved);
  }

  if(action==='requestRevision'){
    const briefId=String(body?.briefId||'');
    const reason=String(body?.reason||'').trim();
    if(!uuid(briefId))return responseError('invalid_brief');
    if(!reason)return responseError('reason_required');
    const result=await jdAction('requestRevision',{briefId,reason}).catch(()=>null);
    if(!result?.ok)return responseError(result?.error||'revision_request_failed');
    return NextResponse.json(result);
  }

  if(action==='approve'){
    const jobId=String(body?.jobId||'');
    const briefId=String(body?.briefId||'');
    if(!uuid(jobId)||!uuid(briefId))return responseError('invalid_approval_target');
    const context=await getRequirementContext(jobId).catch(()=>null);
    if(!context?.ok||context?.brief?.id!==briefId)return responseError('brief_not_found',404);
    const structural=validateAiRequirementOutput({
      fields:context.brief.structured_data||{},
      criteria:context.criteria||[],
      clarifications:context.clarifications||[],
      hiringBrief:context.brief.hiring_brief||{},
      searchBlueprint:context.brief.search_blueprint||{},
      inputSafety:context.brief.input_safety||{promptInjectionDetected:false,signals:[]},
    });
    if(!structural.ok)return NextResponse.json({ok:false,error:'schema_validation_failed',details:structural.errors.slice(0,30)},{status:422});
    const result=await jdAction('approveBrief',{briefId,note:String(body?.note||'').slice(0,1000)}).catch(()=>null);
    if(!result?.ok)return responseError(result?.error||'approval_failed');
    return NextResponse.json(result);
  }

  return responseError('unsupported_action');
}
