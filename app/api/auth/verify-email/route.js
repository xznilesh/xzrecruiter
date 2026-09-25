import { NextResponse } from 'next/server';
import { getAuthUser, rpc } from '@/lib/supabase-api';
import { consumeRateLimit,rateLimitIdentityForRequest } from '@/lib/rate-limit';
import { mutationRequestIsTrusted,declaredBodyWithin } from '@/lib/request-security';

export async function POST(req) {
  if(!mutationRequestIsTrusted(req))return NextResponse.json({error:'Invalid request origin.'},{status:403});
  if(!declaredBodyWithin(req,32*1024))return NextResponse.json({error:'Request is too large.'},{status:413});
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const accessToken = String(body.accessToken || '');
  if (!accessToken) return NextResponse.json({ error: 'Verification proof is missing.' }, { status: 400 });

  const gate=await consumeRateLimit({
    scope:'auth:verify_email',
    identity:rateLimitIdentityForRequest(req,'verify-email'),
    limit:20,
    windowSeconds:900
  }).catch(()=>null);
  if(!gate?.ok)return NextResponse.json({error:'Verification service is temporarily unavailable.'},{status:503});
  if(!gate.allowed)return NextResponse.json({error:'Too many verification attempts. Try again later.',code:'rate_limited'},{status:429});

  try {
    const authUser = await getAuthUser(accessToken);
    if (!authUser?.email || !(authUser.email_confirmed_at || authUser.confirmed_at)) {
      return NextResponse.json({ error: 'Email is not confirmed.' }, { status: 403 });
    }

    const result = await rpc('xzrecruiter_verify_email', {}, { accessToken });
    if (!result?.ok) return NextResponse.json({ error: 'Could not verify this workspace email.' }, { status: 400 });
    return NextResponse.json({ ok: true, email: authUser.email });
  } catch (error) {
    console.error('verify_email_failed', error?.status || '');
    return NextResponse.json({ error: 'Verification link is invalid or expired.' }, { status: 400 });
  }
}
