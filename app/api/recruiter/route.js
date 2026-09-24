import { NextResponse } from 'next/server';
import { getRecruiterHome,getRecruiterRequirement,recruiterAction } from '@/lib/recruiter';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin}
function uuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))}
function statusFor(error){
  if(error==='unauthorized')return 401;
  if(['assignment_manager_only','recruiter_workspace_forbidden','requirement_access_forbidden','recruiter_intake_forbidden','candidate_access_forbidden','task_access_forbidden','task_forbidden','recruiter_self_assignment_only','resume_upload_forbidden'].includes(error))return 403;
  if(['job_not_found','task_not_found','candidate_not_found','parse_run_not_found'].includes(error))return 404;
  if(['candidate_intake_conflict','duplicate_requires_manager'].includes(error))return 409;
  if(['approved_requirement_required','assignee_not_recruiter','invalid_task_transition'].includes(error))return 422;
  return 400;
}
function fail(error,extra={}){return NextResponse.json({ok:false,error,...extra},{status:statusFor(error)})}

export async function GET(req){
  if(!sameOrigin(req))return fail('invalid_origin');
  const mode=req.nextUrl.searchParams.get('mode')||'home';
  if(mode==='home'){
    const result=await getRecruiterHome(50).catch(()=>null);
    return result?NextResponse.json(result):fail('recruiter_home_unavailable');
  }
  if(mode==='requirement'){
    const jobId=req.nextUrl.searchParams.get('jobId')||'';
    if(!uuid(jobId))return fail('invalid_job');
    const result=await getRecruiterRequirement(jobId,50).catch(()=>null);
    return result?NextResponse.json(result):fail('requirement_context_unavailable');
  }
  if(mode==='candidateSearch'){
    const jobId=req.nextUrl.searchParams.get('jobId')||'';
    const q=String(req.nextUrl.searchParams.get('q')||'').slice(0,200);
    if(!uuid(jobId))return fail('invalid_job');
    const result=await recruiterAction('candidateSearch',{jobId,query:q,limit:20}).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'candidate_search_failed');
    return NextResponse.json(result);
  }
  return fail('unsupported_mode');
}

export async function POST(req){
  if(!sameOrigin(req))return fail('invalid_origin');
  let body;try{body=await req.json()}catch{return fail('invalid_json')}
  const action=String(body?.action||'');

  if(action==='saveAssignment'){
    if(!uuid(body?.jobId)||!uuid(body?.recruiterUserId))return fail('invalid_assignment');
    const result=await recruiterAction('saveAssignment',{
      jobId:body.jobId,recruiterUserId:body.recruiterUserId,
      dailyTarget:body.dailyTarget,totalTarget:body.totalTarget,status:String(body.status||'ACTIVE').slice(0,30),
      priorityContext:String(body.priorityContext||'').slice(0,500),
      managerInstructions:String(body.managerInstructions||'').slice(0,2000),
      idempotencyKey:String(body.idempotencyKey||'').slice(0,160)
    }).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'assignment_save_failed');
    return NextResponse.json(result);
  }

  if(action==='setRequirementTarget'){
    if(!uuid(body?.jobId))return fail('invalid_job');
    const result=await recruiterAction('setRequirementTarget',{jobId:body.jobId,dailyTarget:body.dailyTarget,totalTarget:body.totalTarget}).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'target_update_failed');
    return NextResponse.json(result);
  }

  if(action==='intakeCandidate'){
    if(!uuid(body?.jobId))return fail('invalid_job');
    const candidate=body?.candidate||{};
    if(candidate.id&&!uuid(candidate.id))return fail('invalid_candidate');
    const result=await recruiterAction('intakeCandidate',{
      jobId:body.jobId,candidate,
      sourceType:String(body.sourceType||'').slice(0,40),
      sourceReference:String(body.sourceReference||'').slice(0,1000),
      sourcingNotes:String(body.sourcingNotes||'').slice(0,2000),
      idempotencyKey:String(body.idempotencyKey||'').slice(0,160)
    }).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'candidate_intake_failed',result||{});
    return NextResponse.json(result);
  }

  if(action==='saveTask'){
    const task=body?.task||{};
    if(!uuid(task.jobId))return fail('invalid_job');
    for(const key of ['candidateId','applicationId','assignedUserId'])if(task[key]&&!uuid(task[key]))return fail(`invalid_${key}`);
    const result=await recruiterAction('saveTask',{task:{
      jobId:task.jobId,candidateId:task.candidateId||'',applicationId:task.applicationId||'',
      assignedUserId:task.assignedUserId||'',taskType:String(task.taskType||'FOLLOW_UP').slice(0,50),
      title:String(task.title||'').slice(0,500),description:String(task.description||'').slice(0,2000),
      priority:String(task.priority||'NORMAL').slice(0,20),status:'OPEN',
      dueLocal:String(task.dueLocal||'').slice(0,40),idempotencyKey:String(task.idempotencyKey||'').slice(0,160)
    }}).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'task_save_failed');
    return NextResponse.json(result);
  }

  if(action==='setTaskStatus'){
    if(!uuid(body?.taskId))return fail('invalid_task');
    const result=await recruiterAction('setTaskStatus',{taskId:body.taskId,status:String(body.status||'DONE').slice(0,30)}).catch(()=>null);
    if(!result?.ok)return fail(result?.error||'task_status_failed');
    return NextResponse.json(result);
  }
  return fail('unsupported_action');
}
