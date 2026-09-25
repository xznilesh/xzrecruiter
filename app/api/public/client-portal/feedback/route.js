import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';
import { consumeRateLimit,rateLimitIdentityForRequest } from '@/lib/rate-limit';
import { mutationRequestIsTrusted,declaredBodyWithin } from '@/lib/request-security';

export async function POST(req){
 if(!mutationRequestIsTrusted(req))return NextResponse.json({error:'Invalid origin.'},{status:403});
 if(!declaredBodyWithin(req,64*1024))return NextResponse.json({error:'Request is too large.'},{status:413});
 let body;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid request.'},{status:400});}
 const token=String(body.token||'');const submissionId=String(body.submissionId||'');const decision=String(body.decision||'');
 if(!token||!submissionId||!decision)return NextResponse.json({error:'Missing required fields.'},{status:400});
 const gate=await consumeRateLimit({
   scope:'public:client_feedback',identity:rateLimitIdentityForRequest(req,submissionId),limit:30,windowSeconds:600
 }).catch(()=>null);
 if(!gate?.ok)return NextResponse.json({error:'Client portal is temporarily unavailable.'},{status:503});
 if(!gate.allowed)return NextResponse.json({error:'rate_limited'},{status:429});
 try{
   const result=await rpc('xzrecruiter_client_portal_feedback',{
     p_portal_token:token,p_submission_id:submissionId,p_decision:decision,p_comment:String(body.comment||'').slice(0,4000)
   });
   if(!result?.ok){const status=result?.error==='invalid_or_expired'?401:result?.error==='submission_not_found'?404:400;return NextResponse.json(result,{status});}
   return NextResponse.json(result);
 }catch(error){
   console.error('client_portal_feedback_failed');
   return NextResponse.json({error:'Client portal is temporarily unavailable.'},{status:503});
 }
}
