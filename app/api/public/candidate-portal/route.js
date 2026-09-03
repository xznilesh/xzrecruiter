import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin}

export async function POST(req){
 if(!sameOrigin(req))return NextResponse.json({error:'invalid_origin'},{status:403});
 let body;try{body=await req.json()}catch{return NextResponse.json({error:'invalid_request'},{status:400})}
 const token=String(body?.token||'');if(token.length<24)return NextResponse.json({error:'invalid_token'},{status:400});
 try{const result=await rpc('xzrecruiter_candidate_portal_update',{p_portal_token:token,p_patch:body?.patch||{}});if(!result?.ok)return NextResponse.json(result||{error:'update_failed'},{status:result?.error==='invalid_or_expired'?401:400});return NextResponse.json(result)}catch(error){console.error('candidate_portal_update_failed',error?.message||'');return NextResponse.json({error:'portal_temporarily_unavailable'},{status:503})}
}
