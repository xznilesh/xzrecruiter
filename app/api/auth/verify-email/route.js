import { NextResponse } from 'next/server';
import { getAuthUser, rpc } from '@/lib/supabase-api';

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const accessToken = String(body.accessToken || '');
  if (!accessToken) return NextResponse.json({ error: 'Verification proof is missing.' }, { status: 400 });

  try {
    const authUser = await getAuthUser(accessToken);
    if (!authUser?.email || !(authUser.email_confirmed_at || authUser.confirmed_at)) {
      return NextResponse.json({ error: 'Email is not confirmed.' }, { status: 403 });
    }

    const result = await rpc('xzrecruiter_verify_email', {}, { accessToken });
    if (!result?.ok) return NextResponse.json({ error: 'Could not verify this workspace email.' }, { status: 400 });
    return NextResponse.json({ ok: true, email: authUser.email });
  } catch (error) {
    console.error('verify_email_failed', error?.status || '', error?.message || '');
    return NextResponse.json({ error: 'Verification link is invalid or expired.' }, { status: 400 });
  }
}
