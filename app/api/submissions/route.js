import { NextResponse } from 'next/server';
import { getSubmissionContext,getSubmissionQueue,submissionAction } from '@/lib/submissions';
import { AmDecision,ReturnReason,validateAmDecision } from '@/lib/submission-pack.mjs';
import { consumeRateLimit,rateLimitIdentityForRequest } from '@/lib/rate-limit';
import { mutationRequestIsTrusted,declaredBodyWithin } from '@/lib/request-security';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin}
function uuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}
function integer(v){const n=Number(v);return Number.isSafeInteger(n)&&n>=0?n:null}
function statusFor(error){
  if(error==='unauthorized')return 401;
  if(['submission_access_forbidden','recruiter_only','am_only','client_submit_forbidden'].includes(error))return 403;
  if(['application_not_found','submission_not_found','submission_version_missing'].includes(error))return 404;
  if(['stale_submission_version','submission_concurrent_conflict','duplicate_client_submission'].includes(error))return 409;
  if(['submission_not_eligible','submission_pack_stale','stale_approval_blocked','stale_client_submission_blocked','submission_locked_for_review','submission_not_am_approved'].includes(error))return 422;
  return 400;
}
function fail(error,extra={}){return NextResponse.json({ok:false,error,...extra},{status:statusFor(error)})}
function idem(req,body,action){
  const raw=String(req.headers.get('idempotency-key')||body?.idempotencyKey||'').trim();
  if(raw)return raw.slice(0,180);
  return `${action}:${body?.submissionId||body?.applicationId||'unknown'}:${body?.expectedVersion??'na'}:${body?.expectedLock??'na'}`.slice(0,180);
}

export async function GET(req){
  if(!sameOrigin(req))return fail('invalid_origin');
  const mode=String(req.nextUrl.searchParams.get('mode')||'context');
  if(mode==='queue'){
    const bucket=String(req.nextUrl.searchParams.get('bucket')||'WAITING_FOR_REVIEW').slice(0,80);
    const limit=Math.min(100,Math.max(1,Number(req.nextUrl.searchParams.get('limit')||30)));
    const offset=Math.max(0,Number(req.nextUrl.searchParams.get('offset')||0));
    const result=await getSubmissionQueue(bucket,limit,offset).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'submission_queue_unavailable');
    return NextResponse.json(result);
  }
  const applicationId=String(req.nextUrl.searchParams.get('applicationId')||'');
  if(!uuid(applicationId))return fail('invalid_application');
  const result=await getSubmissionContext(applicationId).catch(()=>null);
  if(!result?.ok)return fail(result?.error||'submission_context_unavailable');
  return NextResponse.json(result);
}

export async function POST(req){
  if(!sameOrigin(req)||!mutationRequestIsTrusted(req))return fail('invalid_origin');
  if(!declaredBodyWithin(req,256*1024))return NextResponse.json({ok:false,error:'request_too_large'},{status:413});
  let body;try{body=await req.json()}catch{return fail('invalid_json')}
  const action=String(body?.action||'');
  const expensive=action==='generate'||action==='clientSubmit'||action==='amDecision';
  if(expensive){
    const subject=String(body?.submissionId||body?.applicationId||action);
    const gate=await consumeRateLimit({scope:'submission:'+action.toLowerCase(),identity:rateLimitIdentityForRequest(req,subject),limit:60,windowSeconds:600}).catch(()=>null);
    if(!gate?.ok)return NextResponse.json({ok:false,error:'submission_service_unavailable'},{status:503});
    if(!gate.allowed)return NextResponse.json({ok:false,error:'rate_limited'},{status:429});
  }

  if(action==='generate'){
    const applicationId=String(body?.applicationId||'');if(!uuid(applicationId))return fail('invalid_application');
    const result=await submissionAction('generate',{applicationId,recruiterContext:String(body?.recruiterContext||'').slice(0,1200),idempotencyKey:idem(req,body,action)}).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'submission_generation_failed',result||{});
    return NextResponse.json(result);
  }

  const submissionId=String(body?.submissionId||'');if(!uuid(submissionId))return fail('invalid_submission');
  const expectedVersion=integer(body?.expectedVersion);const expectedLock=integer(body?.expectedLock);
  if(['sendToAm','startReview','amDecision','clientSubmit'].includes(action)&&expectedLock===null)return fail('expected_lock_required');
  if(['sendToAm','amDecision','clientSubmit'].includes(action)&&expectedVersion===null)return fail('expected_version_required');

  if(action==='sendToAm'){
    const result=await submissionAction('sendToAm',{submissionId,expectedVersion,expectedLock,idempotencyKey:idem(req,body,action)}).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'send_to_am_failed',result||{});return NextResponse.json(result);
  }
  if(action==='startReview'){
    const result=await submissionAction('startReview',{submissionId,expectedLock}).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'am_review_start_failed',result||{});return NextResponse.json(result);
  }
  if(action==='amDecision'){
    const decision=String(body?.decision||'').toUpperCase();const reasonCode=String(body?.reasonCode||'').toUpperCase();
    const valid=validateAmDecision({action:decision,reasonCode,note:body?.note});if(!valid.ok)return fail(valid.error);
    if(!Object.values(AmDecision).includes(decision))return fail('invalid_review_action');
    if(reasonCode&&!Object.values(ReturnReason).includes(reasonCode))return fail('invalid_return_reason');
    const result=await submissionAction('amDecision',{submissionId,action:decision,reasonCode,note:String(body?.note||'').slice(0,1500),checklist:body?.checklist&&typeof body.checklist==='object'?body.checklist:{},expectedVersion,expectedLock,idempotencyKey:idem(req,body,action)}).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'am_decision_failed',result||{});return NextResponse.json(result);
  }
  if(action==='clientSubmit'){
    const clientContact=body?.clientContact&&typeof body.clientContact==='object'?body.clientContact:{};
    const result=await submissionAction('clientSubmit',{submissionId,clientContact,expectedVersion,expectedLock,idempotencyKey:idem(req,body,action)}).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'client_submit_failed',result||{});return NextResponse.json(result);
  }
  return fail('unsupported_action');
}
