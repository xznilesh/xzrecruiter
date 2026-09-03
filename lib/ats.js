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
    portalAccess: ['xzrecruiter_issue_candidate_portal_access', { p_token: token, p_candidate_id: args.candidateId }]
  };
  const entry = map[name];
  if (!entry) return { ok: false, error: 'unsupported_action' };
  return rpc(entry[0], entry[1]);
}
