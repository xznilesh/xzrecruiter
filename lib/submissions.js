import { sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

export async function getSubmissionContext(applicationId){
  const token=await sessionToken();
  if(!token)return null;
  const result=await rpc('xzrecruiter_submission_input',{p_token:token,p_application_id:applicationId});
  return result?.ok?result:null;
}

export async function getSubmissionQueue(bucket='WAITING_FOR_REVIEW',limit=30,offset=0){
  const token=await sessionToken();
  if(!token)return null;
  return rpc('xzrecruiter_submission_queue',{p_token:token,p_bucket:bucket,p_limit:limit,p_offset:offset});
}

export async function submissionAction(name,args={}){
  const token=await sessionToken();
  if(!token)return {ok:false,error:'unauthorized'};
  const map={
    generate:['xzrecruiter_generate_submission_pack',{
      p_token:token,p_application_id:args.applicationId,p_recruiter_context:args.recruiterContext||null,p_idempotency_key:args.idempotencyKey||null
    }],
    sendToAm:['xzrecruiter_send_submission_to_am',{
      p_token:token,p_submission_id:args.submissionId,p_expected_version:Number(args.expectedVersion),
      p_expected_lock:Number(args.expectedLock),p_idempotency_key:args.idempotencyKey||null
    }],
    startReview:['xzrecruiter_start_submission_review',{
      p_token:token,p_submission_id:args.submissionId,p_expected_lock:Number(args.expectedLock)
    }],
    amDecision:['xzrecruiter_am_submission_decision',{
      p_token:token,p_submission_id:args.submissionId,p_action:args.action,p_reason_code:args.reasonCode||null,
      p_note:args.note||null,p_checklist:args.checklist||{},p_expected_version:Number(args.expectedVersion),
      p_expected_lock:Number(args.expectedLock),p_idempotency_key:args.idempotencyKey||null
    }],
    clientSubmit:['xzrecruiter_client_submit',{
      p_token:token,p_submission_id:args.submissionId,p_client_contact:args.clientContact||{},
      p_expected_version:Number(args.expectedVersion),p_expected_lock:Number(args.expectedLock),p_idempotency_key:args.idempotencyKey||null
    }]
  };
  const entry=map[name];
  if(!entry)return {ok:false,error:'unsupported_action'};
  return rpc(entry[0],entry[1]);
}
