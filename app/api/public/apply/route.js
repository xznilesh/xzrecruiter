import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin;}

export async function POST(req){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin.'},{status:403});
 let body;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid request.'},{status:400});}
 const slug=String(body.slug||'').trim();if(!slug)return NextResponse.json({error:'Missing job.'},{status:400});
 try{const result=await rpc('xzrecruiter_public_apply',{p_slug:slug,p_application:body.payload||{}});if(!result?.ok){const status=result?.error==='not_found'?404:result?.error==='already_applied'?409:400;return NextResponse.json(result,{status});}return NextResponse.json(result,{status:201});}
 catch(error){console.error('public_apply_failed',error?.message||'');return NextResponse.json({error:'Application service unavailable.'},{status:503});}
}
