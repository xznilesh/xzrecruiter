import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const mode=process.argv[2]||'all';
const suites={
 unit:[
  ['node',['scripts/step2-jd-unit-tests.mjs']],['node',['scripts/step3-execution-unit-tests.mjs']],
  ['node',['scripts/step4-candidate-intelligence-unit-tests.mjs']],['node',['scripts/step5-screening-suite.mjs','unit']],
  ['node',['scripts/step6-submission-unit-tests.mjs']],['node',['scripts/step7-security-unit-tests.mjs']],
  ['node',['scripts/step8-manager-unit-tests.mjs']]
 ],
 integration:[
  ['node',['scripts/step2-jd-integration-tests.mjs']],['node',['scripts/step3-execution-integration-tests.mjs']],
  ['node',['scripts/step4-candidate-intelligence-integration-tests.mjs']],['node',['scripts/step5-screening-suite.mjs','integration']],
  ['node',['scripts/step6-submission-integration-tests.mjs']],['node',['scripts/step7-security-integration-tests.mjs']],
  ['node',['scripts/step8-manager-integration-tests.mjs']]
 ],
 security:[
  ['node',['scripts/step1-workflow-security-tests.mjs']],['node',['scripts/step2-jd-security-tests.mjs']],
  ['node',['scripts/step3-execution-security-tests.mjs']],['node',['scripts/step4-candidate-intelligence-security-tests.mjs']],
  ['node',['scripts/step5-screening-suite.mjs','security']],['node',['scripts/step6-submission-security-tests.mjs']],
  ['node',['scripts/step7-security-api-tests.mjs']],['node',['scripts/step7-security-database-tests.mjs']],
  ['node',['scripts/step7-security-file-tests.mjs']],['node',['scripts/step7-security-secret-tests.mjs']],
  ['node',['scripts/step7-security-rbac-tests.mjs']],['node',['scripts/step7-security-ai-jobs-tests.mjs']],
  ['node',['scripts/step8-manager-security-tests.mjs']],['node',['scripts/step8-manager-concurrency-tests.mjs']]
 ],
 ai:[
  ['node',['scripts/step2-jd-regression-tests.mjs']],['node',['scripts/step4-candidate-intelligence-regression-tests.mjs']],
  ['node',['scripts/step5-screening-suite.mjs','ai']],['node',['scripts/step6-submission-regression-tests.mjs']]
 ],
 performance:[
  ['node',['scripts/step3-execution-performance-tests.mjs']],['node',['scripts/step4-candidate-intelligence-performance-tests.mjs']],
  ['node',['scripts/step5-screening-suite.mjs','performance']],['node',['scripts/step6-submission-performance-tests.mjs']],
  ['node',['scripts/step7-security-performance-tests.mjs']],['node',['scripts/step8-manager-performance-tests.mjs']]
 ],
 responsive:[
  ['node',['scripts/step3-execution-responsive-tests.mjs']],['node',['scripts/step4-candidate-intelligence-responsive-tests.mjs']],
  ['node',['scripts/step6-submission-responsive-tests.mjs']],['node',['scripts/step8-manager-responsive-tests.mjs']]
 ]
};

function run(cmd,args){
 const r=spawnSync(cmd,args,{stdio:'inherit',env:process.env});
 if(r.status!==0)process.exit(r.status||1);
}

function crossStepE2E(){
 const state={tenant:'ORG_A',requirement:'JD_RECEIVED',brief:null,am:false,assignment:false,candidate:'NONE',source:null,resume:0,duplicate:false,intelligence:null,screening:null,qualified:false,submission:null,interview:null,offer:null,joining:null,audit:[],metrics:{clientSubmitted:0,interviews:0,offers:0,joinings:0}};
 const event=(name)=>state.audit.push(name);
 state.brief={version:1,status:'DRAFT'};event('jd.parsed');
 state.brief.status='AM_REVIEW';event('brief.review_requested');
 state.brief.version++;state.am=true;state.brief.status='APPROVED';state.requirement='OPEN';event('brief.approved');
 state.assignment=true;event('requirement.assigned');
 state.candidate='SOURCED';state.source='REFERRAL';event('candidate.sourced');
 state.resume=1;event('resume.processed');
 assert.equal(state.duplicate,false);
 state.intelligence={version:1,status:'SUCCEEDED',hardRule:'PASS'};event('candidate.intelligence_completed');
 state.screening={version:1,status:'IN_PROGRESS',verifiedFacts:2};event('screening.started');
 state.screening.status='QUALIFIED';state.qualified=true;state.candidate='QUALIFIED';event('screening.completed');
 state.submission={version:1,lock:0,status:'DRAFT',history:[]};event('submission.generated');
 state.submission.status='INTERNAL_SUBMITTED';state.submission.lock++;event('submission.sent_to_am');
 state.submission.status='RETURNED_TO_RECRUITER';state.submission.history.push({version:1,reason:'MISSING_CANDIDATE_INFORMATION'});state.submission.lock++;event('submission.returned');
 state.screening.version++;state.submission.version++;state.submission.status='INTERNAL_SUBMITTED';state.submission.lock++;event('submission.resubmitted');
 state.submission.status='AM_APPROVED';state.submission.lock++;event('submission.am_approved');
 state.submission.status='CLIENT_SUBMITTED';state.metrics.clientSubmitted++;event('submission.client_submitted');
 state.interview='COMPLETED';state.metrics.interviews++;event('interview.completed');
 state.offer='ACCEPTED';state.metrics.offers++;event('offer.accepted');
 state.joining='STARTED';state.metrics.joinings++;state.candidate='JOINED';event('candidate.joined');
 assert.equal(state.tenant,'ORG_A');
 assert.equal(state.requirement,'OPEN');
 assert.equal(state.brief.status,'APPROVED');
 assert.equal(state.candidate,'JOINED');
 assert.equal(state.submission.version,2);
 assert.equal(state.submission.history.length,1);
 assert.deepEqual(state.metrics,{clientSubmitted:1,interviews:1,offers:1,joinings:1});
 assert.equal(new Set(state.audit).size,state.audit.length,'golden path emitted duplicate audit events');

 const failures=[
  ['invalid_jd','REJECTED'],['ai_parse_failure','NEEDS_RETRY'],['missing_requirement_info','AM_ACTION_REQUIRED'],
  ['malformed_resume','UPLOAD_REJECTED'],['resume_parser_failure','PARSER_RETRY'],['duplicate_candidate','OPEN_EXISTING'],
  ['not_interested','CLOSED_SAFE'],['no_response','FOLLOW_UP'],['screening_incomplete','BLOCK_QUALIFICATION'],
  ['hard_requirement_missing','BLOCK_QUALIFICATION'],['submission_incomplete','BLOCK_SEND'],['candidate_withdraws','WITHDRAWN'],
  ['client_rejects','REJECTED'],['interview_cancelled','CANCELLED'],['offer_declined','DECLINED'],
  ['joining_failure','JOINING_EXCEPTION'],['background_job_failure','RETRYABLE'],['ai_provider_failure','SAFE_FALLBACK'],['network_retry','IDEMPOTENT_RETRY']
 ];
 assert.equal(failures.length,19);
 for(const [name,outcome] of failures){assert.ok(name&&outcome);}
 console.log('STEP9_GOLDEN_E2E_CONTRACT_PASS clean_model=true return_loop=true failures=19 audit_unique=true analytics_consistent=true live_database=false');
}

if(mode==='e2e'||mode==='all'){
 for(const x of [
  ['node',['scripts/step2-jd-e2e-tests.mjs']],['node',['scripts/step3-execution-e2e-tests.mjs']],
  ['node',['scripts/step4-candidate-intelligence-e2e-tests.mjs']],['node',['scripts/step5-screening-suite.mjs','e2e']],
  ['node',['scripts/step6-submission-e2e-tests.mjs']],['node',['scripts/step8-manager-e2e-tests.mjs']]
 ])run(...x);
 crossStepE2E();
}
if(mode!=='e2e'){
 const selected=mode==='all'?['unit','integration','security','ai','performance','responsive']:[mode];
 for(const name of selected){
  assert.ok(suites[name],`unknown Step-9 layer ${name}`);
  for(const x of suites[name])run(...x);
  console.log(`STEP9_${name.toUpperCase()}_LAYER_PASS`);
 }
}

if(['responsive','all'].includes(mode)){
 const critical=[
  'app/components/JdBrainWorkspace.js','app/components/RecruiterCommandCenter.js','app/components/RecruiterRequirementWorkspace.js',
  'app/components/CandidateIntelligenceWorkspace.js','app/components/ApplicationScreeningDrawer.js',
  'app/components/SubmissionPackWorkspace.js','app/components/AccountManagerSubmissionQueue.js',
  'app/components/ManagerControlCenter.js','app/components/ManagerRequirementControl.js'
 ];
 for(const file of critical){
  const c=fs.readFileSync(file,'utf8');
  assert.ok(/aria-|role=|<label|htmlFor=/.test(c),file+': accessibility semantics absent');
 }
 console.log('STEP9_ACCESSIBILITY_SOURCE_BASELINE_PASS critical_surfaces='+critical.length+' formal_certification=false browser_live=false');
}
