import { NextResponse } from 'next/server';
import { sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

export const dynamic = 'force-dynamic';

function sameOrigin(req) {
  const origin = req.headers.get('origin');
  return !origin || origin === req.nextUrl.origin;
}

function statusFor(error) {
  if (error === 'unauthorized') return 401;
  if (error === 'forbidden') return 403;
  return 400;
}

export async function GET() {
  const token = await sessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const result = await rpc('xzrecruiter_onboarding_context', { p_token: token });
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'Unauthorized.' }, { status: statusFor(result?.error) });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('onboarding_context_failed', error?.message || '');
    return NextResponse.json({ error: 'Setup is temporarily unavailable.' }, { status: 503 });
  }
}

export async function PUT(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const token = await sessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  try {
    const result = await rpc('xzrecruiter_save_onboarding_section', {
      p_token: token,
      p_section: String(body.section || ''),
      p_payload: body.payload || {},
      p_mark_complete: !!body.markComplete
    });
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'Could not save setup.' }, { status: statusFor(result?.error) });
    return NextResponse.json(result);
  } catch (error) {
    console.error('onboarding_save_failed', error?.message || '');
    return NextResponse.json({ error: 'Could not save setup.' }, { status: 503 });
  }
}

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const token = await sessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const result = await rpc('xzrecruiter_complete_onboarding', { p_token: token });
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'Setup is incomplete.', missing: result?.missing || [] }, { status: statusFor(result?.error) });
    return NextResponse.json(result);
  } catch (error) {
    console.error('onboarding_complete_failed', error?.message || '');
    return NextResponse.json({ error: 'Could not complete setup.' }, { status: 503 });
  }
}
