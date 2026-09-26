import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sessionToken } from '@/lib/auth';
import { consumeRateLimit } from '@/lib/rate-limit';
import { getCandidateIntelligenceContext,getCandidateIntelligenceInput,candidateIntelligenceAction } from '@/lib/candidate-intelligence';
import { analyzeCandidateServer,candidateAiConfigured } from '@/lib/candidate-ai-server';
import { createCandidateInputHash } from '@/lib/candidate-ai.mjs';
import { CANDIDATE_AI_PROMPT_VERSION,CANDIDATE_AI_SCHEMA_VERSION } from '@/lib/candidate-ai-contract.mjs';
import {
  buildCandidateProfileSnapshot,candidateProfileHash,candidateMatchIdempotencyKey,computeCandidateMatch,
  CANDIDATE_PROMPT_VERSION,CANDIDATE_MATCH_SCHEMA_VERSION,SCORING_CONFIG_VERSION
} from '@/lib/candidate-intelligence.mjs';

import { mutationRequestIsTrusted,declaredBodyWithin } from '@/lib/request-security';
export const runtime='nodejs';
export const dynamic='force-dynamic';

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin}
function uuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))}
function statusFor(error){
  if(error==='unauthorized')return 401;
  if(['candidate_intelligence_forbidden','requirement_access_forbidden'].includes(error))return 403;
  if(['candidate_not_found','match_not_found','intelligence_job_not_found','parse_run_not_found'].includes(error))return 404;
  if(['already_processing','candidate_intelligence_concurrent_conflict'].includes(error))return 409;
  if(['approved_brief_required','stale_input_during_analysis','stale_match_recompute_required','override_reason_required'].includes(error))return 422;
  if(error==='rate_limited')return 429;
  if(error==='candidate_ai_timeout')return 504;
  if(error?.startsWith?.('candidate_ai_'))return 503;
  return 400;
}
function fail(error,extra={}){return NextResponse.json({ok:false,error,...extra},{status:statusFor(error)})}

function requirementContext(input){
  return {
    briefId:input?.brief?.id,
    briefVersion:input?.brief?.version_number,
    fields:input?.brief?.structured_data||{},
    hiringBrief:input?.brief?.hiring_brief||{},
    criteria:Array.isArray(input?.criteria)?input.criteria:[],
  };
}

export async function GET(req){
  if(!sameOrigin(req))return fail('invalid_origin');
  const mode=req.nextUrl.searchParams.get('mode')||'context';
  const jobId=String(req.nextUrl.searchParams.get('jobId')||'');
  if(!uuid(jobId))return fail('invalid_job');

  if(mode==='talentSearch'){
    const query=String(req.nextUrl.searchParams.get('q')||'').slice(0,200);
    const result=await candidateIntelligenceAction('talentSearch',{jobId,query,limit:30}).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'talent_search_failed');
    return NextResponse.json(result);
  }

  const candidateId=String(req.nextUrl.searchParams.get('candidateId')||'');
  if(!uuid(candidateId))return fail('invalid_candidate');
  const context=await getCandidateIntelligenceContext(jobId,candidateId).catch(()=>null);
  if(!context)return fail('candidate_intelligence_unavailable');
  return NextResponse.json({...context,aiConfigured:candidateAiConfigured()});
}

export async function POST(req){
  if(!sameOrigin(req)||!mutationRequestIsTrusted(req))return fail('invalid_origin');
  if(!declaredBodyWithin(req,512*1024))return NextResponse.json({ok:false,error:'request_too_large'},{status:413});
  let body;try{body=await req.json()}catch{return fail('invalid_json')}
  const action=String(body?.action||'');

  if(action==='analyze'){
    const jobId=String(body?.jobId||''),candidateId=String(body?.candidateId||'');
    if(!uuid(jobId)||!uuid(candidateId))return fail('invalid_target');

    const input=await getCandidateIntelligenceInput(jobId,candidateId).catch(()=>null);
    if(!input?.ok)return fail(input?.error||'candidate_intelligence_input_failed');
    const token=await sessionToken();
    if(!token)return fail('unauthorized');
    const rate=await consumeRateLimit({
      scope:'ai:candidate_intelligence',identity:token,limit:30,windowSeconds:600
    }).catch(()=>null);
    if(!rate?.ok)return fail('candidate_ai_rate_limit_unavailable');
    if(!rate.allowed)return fail('rate_limited');

    const candidate=input.candidate||{};
    const parseRun=input.parse_run||{};
    const approved=requirementContext(input);
    const resumeText=String(parseRun.extracted_text||parseRun?.extracted_data?.textPreview||'');
    const model=candidateAiConfigured()
      ?(process.env.XZRECRUITER_CANDIDATE_MODEL||process.env.XZRECRUITER_JD_MODEL||'gpt-5.6-terra')
      :'LOCAL_FALLBACK';
    const sourceMeta={
      candidateUpdatedAt:candidate.updated_at||null,
      parseRunId:parseRun.id||null,
      parseUpdatedAt:parseRun.updated_at||null,
      documentId:parseRun.document_id||null,
      documentVersion:parseRun.document_version||null,
      documentChecksum:parseRun.checksum||null,
      briefFingerprint:input?.brief?.source_fingerprint||null
    };
    const inputHash=createCandidateInputHash({resumeText,candidateProfile:candidate,requirementContext:approved,sourceMeta});
    const scoringVersion=String(input?.scoring?.version||SCORING_CONFIG_VERSION);
    const idempotencyKey=candidateMatchIdempotencyKey({
      agencyId:input.agency_id,jobId,candidateId,briefId:input?.brief?.id,
      profileHash:inputHash,scoringVersion,promptVersion:CANDIDATE_AI_PROMPT_VERSION,
      schemaVersion:CANDIDATE_AI_SCHEMA_VERSION
    });

    const begin=await candidateIntelligenceAction('begin',{
      jobId,candidateId,idempotencyKey,inputHash,modelRequested:model,
      promptVersion:CANDIDATE_AI_PROMPT_VERSION,schemaVersion:CANDIDATE_AI_SCHEMA_VERSION,scoringVersion
    }).catch(()=>null);
    if(!begin?.ok)return fail(begin?.error||'candidate_intelligence_begin_failed');
    if(begin.reused&&begin.run_status==='SUCCEEDED'){
      const context=await getCandidateIntelligenceContext(jobId,candidateId).catch(()=>null);
      return NextResponse.json({ok:true,reused:true,context});
    }
    if(begin.reused&&begin.run_status==='PROCESSING')return fail('already_processing',{runId:begin.run_id});

    const started=Date.now();
    let aiExtraction={};
    let aiMeta={model:'LOCAL_FALLBACK',promptVersion:CANDIDATE_AI_PROMPT_VERSION,schemaVersion:CANDIDATE_AI_SCHEMA_VERSION,matchSchemaVersion:CANDIDATE_MATCH_SCHEMA_VERSION,usage:null};

    if(candidateAiConfigured()){
      try{
        const result=await analyzeCandidateServer({resumeText,candidateProfile:candidate,requirementContext:approved,model});
        aiExtraction=result.data;
        aiMeta={
          model:result.resolvedModel,providerResponseId:result.providerResponseId,
          promptVersion:result.promptVersion,schemaVersion:result.schemaVersion,usage:result.usage||null,
          attempt:result.attempt,inputHash
        };
      }catch(error){
        const code=String(error?.code||error?.message||'candidate_ai_analysis_failed').slice(0,120);
        await candidateIntelligenceAction('complete',{
          runId:begin.run_id,profile:{},profileHash:'',sourceFingerprint:'',match:{},aiMeta:{model},
          latencyMs:Date.now()-started,errorCode:code,errorDetail:'Candidate AI extraction failed. No match was written; retry is safe.'
        }).catch(()=>null);
        console.error('candidate_ai_analysis_failed',code);
        return fail(code);
      }
    }

    const profile=buildCandidateProfileSnapshot({candidate,parseRun,aiExtraction,resumeText});
    if(!candidateAiConfigured()){
      profile.signals.missingCriticalInformation=[
        ...(profile.signals.missingCriticalInformation||[]),
        'AI enrichment is unavailable; this result uses recruiter-supplied profile data and the local resume parser only.'
      ];
    }
    const profileHash=candidateProfileHash(profile);
    const match=computeCandidateMatch({
      criteria:input.criteria||[],
      brief:{fields:input?.brief?.structured_data||{},hiringBrief:input?.brief?.hiring_brief||{}},
      profile,weights:input?.scoring?.weights||{}
    });
    const sourceFingerprint=createHash('sha256').update([
      String(candidate.updated_at||''),String(parseRun.id||''),String(parseRun.updated_at||''),
      String(parseRun.checksum||''),String(input?.brief?.source_fingerprint||'')
    ].join('|')).digest('hex');

    const completed=await candidateIntelligenceAction('complete',{
      runId:begin.run_id,profile,profileHash,sourceFingerprint,match,aiMeta,latencyMs:Date.now()-started
    }).catch(()=>null);
    if(!completed?.ok)return fail(completed?.error||'candidate_intelligence_complete_failed',completed||{});

    const context=await getCandidateIntelligenceContext(jobId,candidateId).catch(()=>null);
    return NextResponse.json({ok:true,reused:false,context});
  }

  if(action==='review'){
    const matchId=String(body?.matchId||'');
    if(!uuid(matchId))return fail('invalid_match');
    const reviewAction=String(body?.reviewAction||'').slice(0,60);
    const reason=String(body?.reason||'').slice(0,1500);
    const result=await candidateIntelligenceAction('review',{matchId,action:reviewAction,reason}).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'candidate_intelligence_review_failed');
    return NextResponse.json(result);
  }

  return fail('unsupported_action');
}
