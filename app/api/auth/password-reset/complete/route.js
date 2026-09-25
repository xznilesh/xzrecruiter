import { NextResponse } from 'next/server';
import { getAuthUser,rpc } from '@/lib/supabase-api';
import { consumeRateLimit,rateLimitIdentityForRequest } from '@/lib/rate-limit';
import { mutationRequestIsTrusted,declaredBodyWithin } from '@/lib/request-security';

export async function POST(req){
  if(!mutationRequestIsTrusted(req))return NextResponse.json({error:'Invalid request origin.'},{status:403});
  if(!declaredBodyWithin(req,16*1024))return NextResponse.json({error:'Request is too large.'},{status:413});
  let body;
  try{body=await req.json();}
  catch{return NextResponse.json({error:'Invalid request.'},{status:400});}

  const accessToken=String(body.accessToken||'');
  let intent=String(body.intent||'');
  if(!intent){
    try{intent=new URL(req.headers.get('referer')||'').searchParams.get('intent')||'';}
    catch{}
  }
  const password=String(body.password||'');
  if(!accessToken||!intent)return NextResponse.json({error:'Reset proof is missing.'},{status:400});
  if(password.length<12)return NextResponse.json({error:'Use a password with at least 12 characters.'},{status:400});

  try{
    const gate=await consumeRateLimit({
      scope:'auth:password_reset_complete',identity:rateLimitIdentityForRequest(req,intent.slice(0,64)),limit:10,windowSeconds:900
    });
    if(!gate.allowed)return NextResponse.json({error:'Too many attempts. Request a new reset link.'},{status:429});
  }catch{
    return NextResponse.json({error:'Reset service is temporarily unavailable.'},{status:503});
  }

  try{
    const authUser=await getAuthUser(accessToken);
    if(!authUser?.email||!(authUser.email_confirmed_at||authUser.confirmed_at)){
      return NextResponse.json({error:'Email proof is not valid.'},{status:403});
    }
    const result=await rpc('xzrecruiter_reset_password_verified',{p_intent:intent,p_new_password:password},{accessToken});
    if(!result?.ok)return NextResponse.json({error:'Reset link is invalid or expired.'},{status:400});
    return NextResponse.json({ok:true});
  }catch(error){
    console.error('password_reset_failed',error?.status||'',error?.message||'');
    return NextResponse.json({error:'Reset link is invalid or expired.'},{status:400});
  }
}
