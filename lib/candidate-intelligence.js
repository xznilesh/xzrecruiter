import { sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

export async function getCandidateIntelligenceContext(jobId,candidateId){
  const token=await sessionToken();
  if(!token)return null;
  const result=await rpc('xzrecruiter_candidate_intelligence_context',{p_token:token,p_job_id:jobId,p_candidate_id:candidateId});
  return result?.ok?result:null;
}

export async function getCandidateIntelligenceInput(jobId,candidateId){
  const token=await sessionToken();
  if(!token)return {ok:false,error:'unauthorized'};
  return rpc('xzrecruiter_candidate_intelligence_input',{p_token:token,p_job_id:jobId,p_candidate_id:candidateId});
}

export async function candidateIntelligenceAction(name,args={}){
  const token=await sessionToken();
  if(!token)return {ok:false,error:'unauthorized'};
  const map={
    storeParseText:['xzrecruiter_store_candidate_parse_text',{
      p_token:token,p_job_id:args.jobId,p_parse_run_id:args.parseRunId,p_extracted_text:args.extractedText||''
    }],
    begin:['xzrecruiter_begin_candidate_intelligence',{
      p_token:token,p_job_id:args.jobId,p_candidate_id:args.candidateId,p_idempotency_key:args.idempotencyKey,
      p_input_hash:args.inputHash,p_model_requested:args.modelRequested,p_prompt_version:args.promptVersion,
      p_schema_version:args.schemaVersion,p_scoring_version:args.scoringVersion
    }],
    complete:['xzrecruiter_complete_candidate_intelligence',{
      p_token:token,p_run_id:args.runId,p_profile_json:args.profile||{},p_profile_hash:args.profileHash||'',
      p_source_fingerprint:args.sourceFingerprint||'',p_match_json:args.match||{},p_ai_meta:args.aiMeta||{},
      p_latency_ms:Number(args.latencyMs||0),p_error_code:args.errorCode||null,p_error_detail:args.errorDetail||null
    }],
    review:['xzrecruiter_review_candidate_intelligence',{
      p_token:token,p_match_id:args.matchId,p_action:args.action,p_reason:args.reason||null
    }],
    talentSearch:['xzrecruiter_talent_match_search',{
      p_token:token,p_job_id:args.jobId,p_query:args.query||'',p_limit:Number(args.limit||30)
    }]
  };
  const entry=map[name];
  if(!entry)return {ok:false,error:'unsupported_action'};
  return rpc(entry[0],entry[1]);
}
