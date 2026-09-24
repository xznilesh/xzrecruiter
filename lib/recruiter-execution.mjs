export const SOURCE_TYPES=Object.freeze([
  'LINKEDIN','MONSTER','DICE','INDEED','NAUKRI','INTERNAL_DATABASE','REFERRAL','APPLICANT','CSV','OTHER'
]);

export const ASSIGNMENT_STATUSES=Object.freeze(['ACTIVE','PAUSED','COMPLETED','REMOVED']);
export const EXECUTION_TASK_TYPES=Object.freeze([
  'CONTACT_CANDIDATE','FOLLOW_UP','COLLECT_RESUME','CONFIRM_AVAILABILITY','SCREENING_DUE','MISSING_INFORMATION','MANAGER_CLARIFICATION'
]);
export const EXECUTION_TASK_STATUSES=Object.freeze(['OPEN','IN_PROGRESS','DONE','CANCELLED']);
export const PRIORITY_WEIGHT=Object.freeze({URGENT:4,HIGH:3,NORMAL:2,LOW:1});

export function normalizeSourceType(value){
  const v=String(value||'').trim().toUpperCase().replace(/[ -]+/g,'_');
  return SOURCE_TYPES.includes(v)?v:null;
}

export function remainingTarget(dailyTarget,validSubmissionsToday){
  return Math.max(0,Number(dailyTarget||0)-Number(validSubmissionsToday||0));
}

export function targetProgress(dailyTarget,validSubmissionsToday){
  const target=Math.max(0,Number(dailyTarget||0));
  const done=Math.max(0,Number(validSubmissionsToday||0));
  return target===0?0:Math.min(100,Math.round(done/target*100));
}

export function localBusinessDate(now=new Date(),timeZone='UTC'){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(now);
  const map=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function deterministicRequirementScore(item={},now=new Date()){
  const gap=Math.max(0,Number(item.remaining_target||item.remainingTarget||0));
  const priority=PRIORITY_WEIGHT[String(item.priority||'NORMAL').toUpperCase()]||2;
  const due=item.deadline||item.target_fill_date||item.targetFillDate;
  let deadlineWeight=0;
  if(due){
    const ms=new Date(due).getTime()-now.getTime();
    const days=ms/86400000;
    deadlineWeight=days<0?6:days<=1?5:days<=3?4:days<=7?2:0;
  }
  const ageHours=Math.max(0,Number(item.age_hours||item.ageHours||0));
  const ageingWeight=Math.min(5,Math.floor(ageHours/24));
  const ready=Number(item.ready_candidates||item.readyCandidates||0);
  const blockerPenalty=Number(item.blocker_count||item.blockerCount||0)>0?2:0;
  return gap*20+priority*8+deadlineWeight*5+ageingWeight+Math.min(ready,5)-blockerPenalty;
}

export function sortPriorityRequirements(items=[],now=new Date()){
  return [...items].sort((a,b)=>{
    const diff=deterministicRequirementScore(b,now)-deterministicRequirementScore(a,now);
    if(diff!==0)return diff;
    const at=String(a.title||'');const bt=String(b.title||'');
    return at.localeCompare(bt);
  });
}

export function canManageAssignment(role){
  return ['OWNER','ADMIN','RECRUITMENT_MANAGER','ACCOUNT_MANAGER'].includes(String(role||'').toUpperCase());
}

export function canRecruiterExecute(role){
  return ['OWNER','ADMIN','RECRUITMENT_MANAGER','RECRUITER'].includes(String(role||'').toUpperCase());
}

export function validTaskTransition(from,to){
  const allowed={
    OPEN:['IN_PROGRESS','DONE','CANCELLED'],
    IN_PROGRESS:['OPEN','DONE','CANCELLED'],
    DONE:[],
    CANCELLED:[]
  };
  return Boolean(allowed[String(from||'') ]?.includes(String(to||'')));
}

export function isValidSubmissionForTarget(submission={}){
  return submission.workflow_status==='CLIENT_SUBMITTED' &&
    submission.status==='SUBMITTED' &&
    !submission.withdrawn_at &&
    !submission.invalidated_at;
}
