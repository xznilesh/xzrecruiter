import assert from 'node:assert/strict';
import {
  SOURCE_TYPES,normalizeSourceType,remainingTarget,targetProgress,localBusinessDate,
  deterministicRequirementScore,sortPriorityRequirements,canManageAssignment,canRecruiterExecute,
  validTaskTransition,isValidSubmissionForTarget
} from '../lib/recruiter-execution.mjs';

assert.equal(remainingTarget(5,0),5);
assert.equal(remainingTarget(5,2),3);
assert.equal(remainingTarget(5,7),0);
assert.equal(targetProgress(4,2),50);
assert.equal(targetProgress(4,9),100);
assert.equal(targetProgress(0,0),0);

assert.ok(SOURCE_TYPES.includes('LINKEDIN'));
assert.equal(normalizeSourceType('Internal Database'),'INTERNAL_DATABASE');
assert.equal(normalizeSourceType('made-up-source'),null);

assert.equal(canManageAssignment('ACCOUNT_MANAGER'),true);
assert.equal(canManageAssignment('RECRUITMENT_MANAGER'),true);
assert.equal(canManageAssignment('RECRUITER'),false);
assert.equal(canRecruiterExecute('RECRUITER'),true);
assert.equal(canRecruiterExecute('ACCOUNT_MANAGER'),false);

assert.equal(validTaskTransition('OPEN','IN_PROGRESS'),true);
assert.equal(validTaskTransition('OPEN','DONE'),true);
assert.equal(validTaskTransition('DONE','OPEN'),false);
assert.equal(validTaskTransition('CANCELLED','DONE'),false);

const instant=new Date('2026-09-25T20:30:00.000Z');
assert.equal(localBusinessDate(instant,'Asia/Kolkata'),'2026-09-26');
assert.equal(localBusinessDate(instant,'UTC'),'2026-09-25');

const now=new Date('2026-09-26T08:00:00Z');
const roles=[
  {title:'Low gap',remaining_target:1,priority:'NORMAL',target_fill_date:'2026-10-10',age_hours:24,pipeline_candidates:1,blocker_count:0},
  {title:'Urgent gap',remaining_target:4,priority:'HIGH',target_fill_date:'2026-09-27',age_hours:48,pipeline_candidates:3,blocker_count:0},
  {title:'Blocked',remaining_target:4,priority:'HIGH',target_fill_date:'2026-09-27',age_hours:48,pipeline_candidates:3,blocker_count:2}
];
const sorted=sortPriorityRequirements(roles,now);
assert.equal(sorted[0].title,'Urgent gap');
assert.ok(deterministicRequirementScore(roles[1],now)>deterministicRequirementScore(roles[0],now));

assert.equal(isValidSubmissionForTarget({workflow_status:'CLIENT_SUBMITTED',status:'SUBMITTED'}),true);
assert.equal(isValidSubmissionForTarget({workflow_status:'DRAFT',status:'SUBMITTED'}),false);
assert.equal(isValidSubmissionForTarget({workflow_status:'CLIENT_SUBMITTED',status:'DRAFT'}),false);
assert.equal(isValidSubmissionForTarget({workflow_status:'CLIENT_SUBMITTED',status:'SUBMITTED',withdrawn_at:'x'}),false);

console.log('STEP3_EXECUTION_UNIT_PASS targets=true priority=true source=true assignment=true tasks=true timezone=true');
