import { NextResponse } from 'next/server';
import { rpc,requestEmailProof } from '@/lib/supabase-api';
import { consumeRateLimit,rateLimitIdentityForRequest } from '@/lib/rate-limit';
import { mutationRequestIsTrusted,declaredBodyWithin } from '@/lib/request-security';

export async function POST(req){
  if(!mutationRequestIsTrusted(req))return NextResponse.json({error:'Invalid request origin.'},{status:403});
  if(!declaredBodyWithin(req,16*1024))return NextResponse.json({error:'Request is too large.'},{status:413});
  let body;
  try{body=await req.json();}
  catch{return NextResponse.json({error:'Invalid request.'},{status:400});}

  const email=String(body.email||'').trim().toLowerCase();
  if(!email||!email.includes('@'))return NextResponse.json({error:'Enter a valid email.'},{status:400});

  try{
    const gate=await consumeRateLimit({
      scope:'auth:password_reset_request',identity:rateLimitIdentityForRequest(req,email),limit:5,windowSeconds:900
    });
    if(!gate.allowed)return NextResponse.json({ok:true,message:'If the account exists, a secure reset email is on the way.'});
  }catch{
    return NextResponse.json({error:'Reset service is temporarily unavailable.'},{status:503});
  }

  try{
    const intentResult=await rpc('xzrecruiter_password_reset_intent',{p_email:email});
    const intent=intentResult?.intent;
    if(intent)await requestEmailProof(email,`${req.nextUrl.origin}/reset-password?intent=${encodeURIComponent(intent)}`);
  }catch(error){
    console.error('password_reset_email_failed',error?.status||'',error?.message||'');
  }
  return NextResponse.json({ok:true,message:'If the account exists, a secure reset email is on the way.'});
}
