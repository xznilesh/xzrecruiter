import { NextResponse } from 'next/server';
import { rpc,requestEmailProof } from '@/lib/supabase-api';
import { consumeRateLimit,rateLimitIdentityForRequest } from '@/lib/rate-limit';
import { mutationRequestIsTrusted } from '@/lib/request-security';

const messages={
  invalid_profile:'Name, agency and a valid work email are required.',
  weak_password:'Use a password with at least 12 characters.',
  account_exists:'An account with this email already exists. Sign in or resend verification.',
  signup_failed:'Could not create the workspace. Please try again.'
};

export async function POST(req){
  if(!mutationRequestIsTrusted(req))return NextResponse.json({error:'Invalid request origin.'},{status:403});
  let body;
  try{body=await req.json();}
  catch{return NextResponse.json({error:'Invalid request.'},{status:400});}

  const email=String(body.email||'').trim().toLowerCase();
  try{
    const gate=await consumeRateLimit({
      scope:'auth:signup',identity:rateLimitIdentityForRequest(req,email),limit:5,windowSeconds:3600
    });
    if(!gate.allowed)return NextResponse.json({error:'Too many signup attempts. Try again later.',code:'rate_limited'},{status:429});
  }catch{
    return NextResponse.json({error:messages.signup_failed},{status:503});
  }

  try{
    const result=await rpc('xzrecruiter_signup',{
      p_email:email,p_password:String(body.password||''),p_name:String(body.name||''),p_agency:String(body.agency||'')
    });
    if(!result?.ok){
      const status=result?.error==='account_exists'?409:400;
      return NextResponse.json({error:messages[result?.error]||messages.signup_failed,code:result?.error},{status});
    }

    let verificationSent=false;
    try{
      await requestEmailProof(email,`${req.nextUrl.origin}/verify-email`);
      verificationSent=true;
    }catch(mailError){
      console.error('verification_email_failed',mailError?.status||'',mailError?.message||'');
    }
    return NextResponse.json({ok:true,requiresEmailVerification:true,verificationSent},{status:201});
  }catch(error){
    console.error('signup_rpc_failed',error?.status||'',error?.message||'');
    return NextResponse.json({error:messages.signup_failed},{status:503});
  }
}
