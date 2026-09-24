import { sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

export async function getRecruiterHome(){
  const token=await sessionToken();
  if(!token)return null;
  const result=await rpc('xzrecruiter_recruiter_command_center',{p_token:token});
  return result?.ok?result:null;
}

export async function getRecruiterRequirement(jobId){
  const token=await sessionToken();
  if(!token)return null;
  const result=await rpc('xzrecruiter_recruiter_requirement_workspace',{p_token:token,p_job_id:jobId});
  return result?.ok?result:null;
}

export async function recruiterAction(name,args={}){
  const token=await sessionToken();
  if(!token)return {ok:false,error:'unauthorized'};
  const map={
    saveAssignment:['xzrecruiter_save_requirement_assignment',{
      p_token:token,p_job_id:args.jobId,p_recruiter_user_id:args.recruiterUserId,
      p_assignment:{
        dailyTarget:Number(args.dailyTarget||0),
        totalTarget:Number(args.totalTarget||0),
        requirementDailyTarget:Number(args.requirementDailyTarget||0),
        requirementTotalTarget:Number(args.requirementTotalTarget||0),
        status:args.status||'ACTIVE',
        priority:args.priority||'NORMAL',
        managerInstructions:args.managerInstructions||'',
        blockerType:args.blockerType||'',
        blockerReason:args.blockerReason||'',
        blockerOwnerUserId:args.blockerOwnerUserId||''
      }
    }],
    setRequirementTargets:['xzrecruiter_set_requirement_targets',{
      p_token:token,p_job_id:args.jobId,p_daily_target:Number(args.dailyTarget||0),
      p_total_target:Number(args.totalTarget||0)
    }],
    candidateSearch:['xzrecruiter_execution_candidate_search',{
      p_token:token,p_job_id:args.jobId,p_query:args.query||'',p_limit:Number(args.limit||20)
    }],
    intakeCandidate:['xzrecruiter_recruiter_intake_candidate',{
      p_token:token,p_job_id:args.jobId,p_candidate:args.candidate||{},
      p_source_type:args.sourceType,p_source_reference:args.sourceReference||null,
      p_sourcing_notes:args.sourcingNotes||null,p_idempotency_key:args.idempotencyKey||null
    }],
    saveTask:['xzrecruiter_save_execution_task',{p_token:token,p_task:args.task||{}}],
    completeTask:['xzrecruiter_complete_execution_task',{p_token:token,p_task_id:args.taskId}],
    candidateAccess:['xzrecruiter_execution_candidate_access',{p_token:token,p_candidate_id:args.candidateId}]
  };
  const entry=map[name];
  if(!entry)return {ok:false,error:'unsupported_action'};
  return rpc(entry[0],entry[1]);
}
