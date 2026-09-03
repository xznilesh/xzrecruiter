import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin;}
export async function POST(req){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin.'},{status:403});
 let body;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid request.'},{status:400});}
 const token=String(body.token||'');const submissionId=String(body.submissionId||'');const decision=String(body.decision||'');
 if(!token||!submissionId||!decision)return NextResponse.json({error:'Missing required fields.'},{status:400});
 try{const result=await rpc('xzrecruiter_client_portal_feedback',{p_portal_token:token,p_submission_id:submissionId,p_decision:decision,p_comment:String(body.comment||'')});if(!result?.ok){const status=result?.error==='invalid_or_expired'?401:result?.error==='submission_not_found'?404:400;return NextResponse.json(result,{status});}return NextResponse.json(result);}
 catch(error){console.error('client_portal_feedback_failed',error?.message||'');return NextResponse.json({error:'Client portal is temporarily unavailable.'},{status:503});}
}
