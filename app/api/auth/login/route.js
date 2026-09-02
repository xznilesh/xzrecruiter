import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';
import { setSession } from '@/lib/auth';

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  try {
    const result = await rpc('xzrecruiter_login', {
      p_email: String(body.email || ''),
      p_password: String(body.password || '')
    });
    if (!result?.ok) {
      return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
    }
    await setSession(result.token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('login_rpc_failed', error?.status || '', error?.message || '');
    return NextResponse.json({ error: 'Sign in is temporarily unavailable.' }, { status: 503 });
  }
}
