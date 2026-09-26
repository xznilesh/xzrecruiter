import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';
import { mutationRequestIsTrusted,declaredBodyWithin } from '@/lib/request-security';
import { consumeRateLimit,rateLimitIdentityForRequest } from '@/lib/rate-limit';

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin;}
export async function POST(req){
 if(!sameOrigin(req)||!mutationRequestIsTrusted(req))return NextResponse.json({error:'Invalid origin.'},{status:403});
 if(!declaredBodyWithin(req,131072))return NextResponse.json({error:'request_too_large'},{status:413});
 let body;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid request.'},{status:400});}
 const token=String(body.token||'');const submissionId=String(body.submissionId||'');const decision=String(body.decision||'').toUpperCase();
 if(token.length<24||token.length>512||!submissionId||!['SHORTLISTED','INTERVIEW','REJECTED','ON_HOLD'].includes(decision))return NextResponse.json({error:'Invalid request.'},{status:400});
 const comment=String(body.comment||'').slice(0,4000);
 const gate=await consumeRateLimit({scope:'public:client_feedback',identity:rateLimitIdentityForRequest(req,token),limit:60,windowSeconds:600}).catch(()=>null);
 if(!gate?.ok)return NextResponse.json({error:'Client portal is temporarily unavailable.'},{status:503});
 if(!gate.allowed)return NextResponse.json({error:'rate_limited'},{status:429});
 try{const result=await rpc('xzrecruiter_client_portal_feedback',{p_portal_token:token,p_submission_id:submissionId,p_decision:decision,p_comment:comment});if(!result?.ok){const status=result?.error==='invalid_or_expired'?401:result?.error==='submission_not_found'?404:400;return NextResponse.json(result,{status});}return NextResponse.json(result);}
 catch(error){console.error('client_portal_feedback_failed',error?.message||'');return NextResponse.json({error:'Client portal is temporarily unavailable.'},{status:503});}
}
