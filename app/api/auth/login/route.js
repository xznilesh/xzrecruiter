import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';
import { setSession } from '@/lib/auth';

const errors = {
  email_unverified: ['Verify your work email before opening the dashboard.', 403],
  temporarily_locked: ['Too many sign-in attempts. Try again in a few minutes.', 429],
  invalid_credentials: ['Email or password is incorrect.', 401]
};

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  try {
    const result = await rpc('xzrecruiter_login', {
      p_email: String(body.email || ''),
      p_password: String(body.password || '')
    });

    if (!result?.ok || !result?.token) {
      const code = result?.error || 'invalid_credentials';
      const [message, status] = errors[code] || errors.invalid_credentials;
      return NextResponse.json({ error: message, code }, { status });
    }

    await setSession(result.token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('login_rpc_failed', error?.status || '', error?.message || '');
    return NextResponse.json({ error: 'Sign in is temporarily unavailable.' }, { status: 503 });
  }
}
