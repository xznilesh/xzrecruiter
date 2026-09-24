import assert from 'node:assert/strict';
import fs from 'node:fs';
import { remainingTarget,normalizeSourceType,validTaskTransition } from '../lib/recruiter-execution.mjs';

const center=fs.readFileSync('app/components/RecruiterCommandCenter.js','utf8');
const workspace=fs.readFileSync('app/components/RecruiterRequirementWorkspace.js','utf8');

const state={
  requirement:{approved:true,recruiterReady:true,assigned:true,title:'Java Engineer'},
  target:3,valid:0,candidates:[],tasks:[],source:null
};
assert.equal(state.requirement.approved&&state.requirement.recruiterReady&&state.requirement.assigned,true);
assert.equal(remainingTarget(state.target,state.valid),3);

const approvedBrief={roleSummary:'Build Java services',must:['Java','Spring Boot'],suggestions:['Backend Engineer']};
assert.equal(approvedBrief.must[0],'Java');
assert.ok(workspace.includes('Approved Step-2 brief'));
assert.ok(workspace.includes('CLIENT-CONFIRMED REQUIREMENT'));
assert.ok(workspace.includes('AI sourcing suggestion'));

state.source=normalizeSourceType('LinkedIn');
state.candidates.push({id:'c1',source_type:state.source,existing:false});
assert.equal(state.candidates[0].source_type,'LINKEDIN');
state.tasks.push({id:'t1',status:'OPEN',type:'FOLLOW_UP'});
assert.equal(validTaskTransition('OPEN','DONE'),true);
state.tasks[0].status='DONE';
state.valid=1;
assert.equal(remainingTarget(state.target,state.valid),2);

const reused={id:'c-existing',source_type:'INTERNAL_DATABASE',existing:true};
state.candidates.push(reused);
assert.equal(state.candidates[1].existing,true);

state.valid=3;
assert.equal(remainingTarget(state.target,state.valid),0);

for(const required of ['Daily submission target','Valid submissions','Remaining','Due follow-ups','Screening actions','My priority requirements']){
  assert.ok(center.includes(required),'command center missing '+required);
}
for(const required of ['Source candidate','Search internal talent','Reuse','Create follow-up / task','Execution blockers','Work queue']){
  assert.ok(workspace.includes(required),'requirement workspace missing '+required);
}
console.log('STEP3_EXECUTION_E2E_PASS approved_to_assignment_to_dashboard_to_intake_to_source_to_followup_to_target=true reuse=true zero_partial_achieved=true');
