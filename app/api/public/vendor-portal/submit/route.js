import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin;}
export async function POST(req){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin.'},{status:403});
 let body;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid request.'},{status:400});}
 const token=String(body.token||'');if(!token)return NextResponse.json({error:'Missing portal token.'},{status:400});
 try{const result=await rpc('xzrecruiter_vendor_portal_submit',{p_portal_token:token,p_submission:body.payload||{}});if(!result?.ok){const status=result?.error==='invalid_or_expired'?401:result?.error==='job_not_shared'?404:400;return NextResponse.json(result,{status});}return NextResponse.json(result,{status:201});}
 catch(error){console.error('vendor_portal_submit_failed',error?.message||'');return NextResponse.json({error:'Vendor portal is temporarily unavailable.'},{status:503});}
}
