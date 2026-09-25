import { NextResponse } from 'next/server';
import { mutationRequestIsTrusted,declaredBodyWithin } from '@/lib/request-security';
import { getRecruiterHome } from '@/lib/recruiter';
import { atsAction } from '@/lib/ats';

function sameOrigin(req) {
  const origin = req.headers.get('origin');
  return !origin || origin === req.nextUrl.origin;
}

function statusFor(error) {
  if (error === 'unauthorized') return 401;
  if (error === 'forbidden' || error === 'stage_role_forbidden') return 403;
  if (error === 'not_found' || error?.endsWith?.('_not_found')) return 404;
  if (error === 'possible_duplicate' || error === 'application_exists' || error === 'placement_exists' || error === 'already_applied' || error === 'stale_screening_version' || error === 'screening_closed') return 409;
  if (error === 'stage_requirements_missing' || error === 'rejection_reason_required' || error === 'withdrawal_reason_required' || error === 'candidate_interest_required' || error === 'non_overridable_hard_rule' || error === 'override_reason_required' || error === 'fake_verification_forbidden' || error === 'invalid_screening_outcome' || error === 'qualification_requirements_missing' || error === 'candidate_interest_outcome_mismatch') return 422;
  return 400;
}

export async function POST(req) {
  if(!sameOrigin(req)||!mutationRequestIsTrusted(req))return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  if(!declaredBodyWithin(req,1048576))return NextResponse.json({error:'request_too_large'},{status:413});
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  try {
    const action=String(body.action||'');
    const protectedForRecruiter=new Set([
      'saveJob','updateJobProfile','bulkJobAction',
      'saveCandidate','updateCandidateProfile','archiveCandidate','mergeCandidates','bulkCandidateAction',
      'candidateExport','portalAccess','prepareResumeUpload','applyResumeParse','candidateDocumentAccess',
      'talentPoolMembership','createTalentPool','prepareAttachment','attachmentAccess','archiveAttachment'
    ]);
    if(protectedForRecruiter.has(action)){
      const execution=await getRecruiterHome(1).catch(()=>null);
      if(execution?.business_role==='RECRUITER'){
        return NextResponse.json({ok:false,error:'execution_workspace_required'},{status:403});
      }
    }
    const result = await atsAction(action, body.payload || {});
    if (!result?.ok) return NextResponse.json(result || { error: 'Action failed.' }, { status: statusFor(result?.error) });
    return NextResponse.json(result);
  } catch (error) {
    console.error('ats_action_failed', body?.action, error?.message || '');
    return NextResponse.json({ error: 'Recruitment action is temporarily unavailable.' }, { status: 503 });
  }
}
