import { NextResponse } from 'next/server';
import { crmAction } from '@/lib/crm';

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin;}
function statusFor(error){
  if(error==='unauthorized')return 401;
  if(error==='forbidden')return 403;
  if(error==='not_found'||error?.endsWith?.('_not_found'))return 404;
  if(['account_exists','contact_exists','active_dependencies'].includes(error))return 409;
  if(['reason_required','parent_required'].includes(error))return 422;
  return 400;
}
export async function POST(req){
  if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin.'},{status:403});
  let body;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid request.'},{status:400});}
  try{const result=await crmAction(String(body.action||''),body.payload||{});if(!result?.ok)return NextResponse.json(result||{error:'Action failed.'},{status:statusFor(result?.error)});return NextResponse.json(result);}
  catch(error){console.error('crm_action_failed',body?.action,error?.message||'');return NextResponse.json({error:'Business workspace action is temporarily unavailable.'},{status:503});}
}
