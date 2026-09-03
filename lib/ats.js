import { sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

export async function getAtsContext(module, query = '', limit = 50, offset = 0) {
  const token = await sessionToken();
  if (!token) return null;
  const result = await rpc('xzrecruiter_ats_context', {
    p_token: token,
    p_module: module,
    p_query: query,
    p_limit: limit,
    p_offset: offset
  });
  return result?.ok ? result : null;
}

export async function getCandidateSearch(query = '', filters = {}, limit = 50, offset = 0) {
  const token = await sessionToken();
  if (!token) return null;
  const result = await rpc('xzrecruiter_candidate_search', {
    p_token: token,
    p_query: query,
    p_filters: filters || {},
    p_limit: limit,
    p_offset: offset
  });
  return result?.ok ? result : null;
}

export async function getJobSearch(query = '', filters = {}, limit = 50, offset = 0) {
  const token = await sessionToken();
  if (!token) return null;
  const result = await rpc('xzrecruiter_job_search', {
    p_token: token,
    p_query: query,
    p_filters: filters || {},
    p_limit: limit,
    p_offset: offset
  });
  return result?.ok ? result : null;
}

export async function atsAction(name, args = {}) {
  const token = await sessionToken();
  if (!token) return { ok: false, error: 'unauthorized' };
  const map = {
    saveCandidate: ['xzrecruiter_save_candidate', { p_token: token, p_candidate: args }],
    archiveCandidate: ['xzrecruiter_archive_candidate', { p_token: token, p_candidate_id: args.candidateId }],
    saveJob: ['xzrecruiter_save_job', { p_token: token, p_job: args }],
    createApplication: ['xzrecruiter_create_application', { p_token: token, p_candidate_id: args.candidateId, p_job_id: args.jobId }],
    moveApplication: ['xzrecruiter_move_application_stage', { p_token: token, p_application_id: args.applicationId, p_stage_id: args.stageId, p_reason: args.reason || null }],
    scheduleInterview: ['xzrecruiter_schedule_interview', { p_token: token, p_interview: args }],
    saveOffer: ['xzrecruiter_save_offer', { p_token: token, p_offer: args }],
    createPlacement: ['xzrecruiter_create_placement', { p_token: token, p_placement: args }],
    portalAccess: ['xzrecruiter_issue_candidate_portal_access', { p_token: token, p_candidate_id: args.candidateId }],
    prepareResumeUpload: ['xzrecruiter_prepare_candidate_document', { p_token: token, p_candidate_id: args.candidateId, p_filename: args.filename, p_mime_type: args.mimeType, p_size_bytes: args.sizeBytes, p_checksum: args.checksum }],
    finalizeResumeParse: ['xzrecruiter_finalize_candidate_parse', { p_token: token, p_parse_run_id: args.parseRunId, p_extracted_data: args.extractedData || {}, p_field_confidence: args.fieldConfidence || {}, p_field_evidence: args.fieldEvidence || {}, p_error: args.error || null }],
    applyResumeParse: ['xzrecruiter_apply_candidate_parse', { p_token: token, p_parse_run_id: args.parseRunId, p_fields: args.fields || {} }],
    candidateCloseout: ['xzrecruiter_candidate_closeout_context', { p_token: token, p_candidate_id: args.candidateId }],
    talentPoolMembership: ['xzrecruiter_add_candidate_to_pool', { p_token: token, p_candidate_id: args.candidateId, p_pool_id: args.poolId, p_add: args.add !== false }],
    mergeCandidates: ['xzrecruiter_merge_candidates', { p_token: token, p_survivor_id: args.survivorId, p_duplicate_id: args.duplicateId, p_resolution: args.resolution || {} }],
    bulkCandidateAction: ['xzrecruiter_bulk_candidate_action', { p_token: token, p_candidate_ids: args.candidateIds || [], p_action: args.action, p_value: args.value || {} }],
    saveScreeningAnswers: ['xzrecruiter_save_screening_answers', { p_token: token, p_application_id: args.applicationId, p_answers: args.answers || [] }],
    scorecardContext: ['xzrecruiter_scorecard_context', { p_token: token, p_interview_id: args.interviewId || null, p_application_id: args.applicationId || null }],
    submitScorecard: ['xzrecruiter_submit_scorecard', { p_token: token, p_interview_id: args.interviewId, p_template_id: args.templateId, p_ratings: args.ratings || [], p_recommendation: args.recommendation || null, p_comments: args.comments || null, p_submit: args.submit !== false }]
  };
  const entry = map[name];
  if (!entry) return { ok: false, error: 'unsupported_action' };
  return rpc(entry[0], entry[1]);
}
