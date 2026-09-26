import { sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

export async function getRequirementContext(jobId){
  const token=await sessionToken();
  if(!token) return null;
  const result=await rpc('xzrecruiter_requirement_context',{p_token:token,p_job_id:jobId});
  return result?.ok?result:null;
}

export async function jdAction(name,args={}){
  const token=await sessionToken();
  if(!token) return {ok:false,error:'unauthorized'};
  const map={
    prepareSource:['xzrecruiter_prepare_jd_source',{
      p_token:token,p_job_id:args.jobId,p_source_type:args.sourceType,
      p_original_text:args.originalText||null,p_filename:args.filename||null,
      p_mime_type:args.mimeType||null,p_size_bytes:args.sizeBytes??null,
      p_checksum_sha256:args.checksum,
    }],
    finalizeSource:['xzrecruiter_finalize_jd_source',{
      p_token:token,p_source_id:args.sourceId,p_extracted_text:args.extractedText||null,p_error:args.error||null,
    }],
    sourceText:['xzrecruiter_jd_source_text',{p_token:token,p_source_id:args.sourceId}],
    beginAiRun:['xzrecruiter_begin_jd_ai_run',{
      p_token:token,p_source_id:args.sourceId,p_idempotency_key:args.idempotencyKey,
      p_model:args.model,p_prompt_version:args.promptVersion,p_schema_version:args.schemaVersion,
      p_input_hash:args.inputHash,
    }],
    completeAiRun:['xzrecruiter_complete_jd_ai_run',{
      p_token:token,p_run_id:args.runId,p_output:args.output||{},
      p_review_state:args.reviewState||'NEEDS_REVIEW',p_model_resolved:args.modelResolved||null,
      p_provider_response_id:args.providerResponseId||null,p_error_code:args.errorCode||null,
      p_error_detail:args.errorDetail||null,
    }],
    saveBrief:['xzrecruiter_save_hiring_brief',{
      p_token:token,p_brief_id:args.briefId,p_structured_data:args.structuredData||{},
      p_hiring_brief:args.hiringBrief||{},p_search_blueprint:args.searchBlueprint||{},
      p_criteria:args.criteria||[],p_clarifications:args.clarifications||[],
      p_review_state:args.reviewState||'NEEDS_REVIEW',p_reason:args.reason||null,
    }],
    requestRevision:['xzrecruiter_request_hiring_brief_revision',{
      p_token:token,p_brief_id:args.briefId,p_reason:args.reason||'',
    }],
    approveBrief:['xzrecruiter_approve_hiring_brief',{
      p_token:token,p_brief_id:args.briefId,p_note:args.note||null,
    }],
    documentAccess:['xzrecruiter_jd_document_access',{p_token:token,p_source_id:args.sourceId}],
  };
  const entry=map[name];
  if(!entry) return {ok:false,error:'unsupported_action'};
  return rpc(entry[0],entry[1]);
}
