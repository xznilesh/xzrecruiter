import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';
import { setSession } from '@/lib/auth';

const messages = {
  invalid_profile: 'Name, agency and a valid email are required.',
  weak_password: 'Use a password with at least 12 characters.',
  account_exists: 'An account with this email already exists.',
  signup_failed: 'Could not create the workspace. Please try again.'
};

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  try {
    const result = await rpc('xzrecruiter_signup', {
      p_email: String(body.email || ''),
      p_password: String(body.password || ''),
      p_name: String(body.name || ''),
      p_agency: String(body.agency || '')
    });

    if (!result?.ok) {
      const status = result?.error === 'account_exists' ? 409 : 400;
      return NextResponse.json({ error: messages[result?.error] || messages.signup_failed }, { status });
    }

    await setSession(result.token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('signup_rpc_failed', error?.status || '', error?.message || '');
    return NextResponse.json({ error: messages.signup_failed }, { status: 503 });
  }
}
