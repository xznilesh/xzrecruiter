import { NextResponse } from 'next/server';
import { atsAction } from '@/lib/ats';

function sameOrigin(req) {
  const origin = req.headers.get('origin');
  return !origin || origin === req.nextUrl.origin;
}

function statusFor(error) {
  if (error === 'unauthorized') return 401;
  if (error === 'forbidden' || error === 'stage_role_forbidden' || error === 'recruiter_only' || error === 'am_only') return 403;
  if (error === 'not_found' || error?.endsWith?.('_not_found')) return 404;
  if (error === 'possible_duplicate' || error === 'application_exists' || error === 'placement_exists' || error === 'already_applied' || error === 'am_review_pending') return 409;
  if (error === 'stage_requirements_missing' || error === 'rejection_reason_required' || error === 'withdrawal_reason_required' || error === 'invalid_workflow_transition' || error === 'am_quality_gate_required' || error === 'submission_not_am_approved' || error === 'review_reason_required' || error === 'noncanonical_stage') return 422;
  return 400;
}

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  try {
    const result = await atsAction(String(body.action || ''), body.payload || {});
    if (!result?.ok) return NextResponse.json(result || { error: 'Action failed.' }, { status: statusFor(result?.error) });
    return NextResponse.json(result);
  } catch (error) {
    console.error('ats_action_failed', body?.action, error?.message || '');
    return NextResponse.json({ error: 'Recruitment action is temporarily unavailable.' }, { status: 503 });
  }
}
