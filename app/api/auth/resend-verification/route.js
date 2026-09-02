import { NextResponse } from 'next/server';
import { requestEmailProof } from '@/lib/supabase-api';

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });

  try {
    await requestEmailProof(email, `${req.nextUrl.origin}/verify-email`);
  } catch (error) {
    console.error('resend_verification_failed', error?.status || '', error?.message || '');
  }

  return NextResponse.json({ ok: true, message: 'If the account exists, a verification email is on the way.' });
}
