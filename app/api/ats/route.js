import { NextResponse } from 'next/server';
import { atsAction } from '@/lib/ats';

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin}
function statusFor(error){
 if(error==='unauthorized')return 401;
 if(error==='forbidden'||error==='stage_role_forbidden')return 403;
 if(error==='not_found'||error?.endsWith?.('_not_found'))return 404;
 if(['possible_duplicate','application_exists','placement_exists','already_applied','stale_screening_version','screening_closed'].includes(error))return 409;
 if(['stage_requirements_missing','rejection_reason_required','withdrawal_reason_required','candidate_interest_required','non_overridable_hard_rule','override_reason_required','fake_verification_forbidden','invalid_screening_outcome'].includes(error))return 422;
 return 400;
}
export async function POST(req){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin.'},{status:403});
 let body;try{body=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
 try{const result=await atsAction(String(body.action||''),body.payload||{});if(!result?.ok)return NextResponse.json(result||{error:'Action failed.'},{status:statusFor(result?.error)});return NextResponse.json(result)}
 catch(error){console.error('ats_action_failed',body?.action,error?.message||'');return NextResponse.json({error:'Recruitment action is temporarily unavailable.'},{status:503})}
}
