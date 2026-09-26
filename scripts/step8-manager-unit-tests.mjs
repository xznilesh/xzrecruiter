import assert from 'node:assert/strict';
import {
  DEFAULT_CONTROL_THRESHOLDS,remaining,achievement,targetState,severityFor,
  evaluateRequirementHealth,deterministicAlertKey,nextOperationalActions,
  funnelCounts,sourceConversion,workloadStatus
} from '../lib/manager-control.mjs';

assert.equal(remaining(3,1),2);
assert.equal(remaining(1,5),0);
assert.equal(achievement(4,3),75);
assert.equal(achievement(0,0),0);

assert.equal(targetState({planned:3,completed:3,hoursToCutoff:1}),'ON_TRACK');
assert.equal(targetState({planned:3,completed:1,hoursToCutoff:5}),'ON_TRACK');
assert.equal(targetState({planned:3,completed:1,hoursToCutoff:4}),'ATTENTION');
assert.equal(targetState({planned:3,completed:1,hoursToCutoff:2}),'AT_RISK');

assert.equal(severityFor({blocked:true}),'URGENT');
assert.equal(severityFor({overdueHours:3}),'ATTENTION');
assert.equal(severityFor({deadlineDays:1}),'URGENT');

assert.deepEqual(
  evaluateRequirementHealth({status:'ON_HOLD'},DEFAULT_CONTROL_THRESHOLDS),
  {health:'ON_HOLD',reasons:['REQUIREMENT_ON_HOLD']}
);
assert.equal(evaluateRequirementHealth({explicitBlocker:true}).health,'BLOCKED');
const risk=evaluateRequirementHealth({
  dailyTarget:3,validSubmissionsToday:0,hoursToCutoff:1,
  pipelineCount:0,deadlineDays:1
});
assert.equal(risk.health,'AT_RISK');
assert.ok(risk.reasons.includes('TARGET_GAP_CUTOFF_NEAR'));
assert.ok(risk.reasons.includes('INSUFFICIENT_PIPELINE'));
assert.ok(risk.reasons.includes('DEADLINE_IMMINENT'));

const healthy=evaluateRequirementHealth({
  dailyTarget:2,validSubmissionsToday:2,hoursToCutoff:6,pipelineCount:4,
  overdueScreenings:0,overdueFollowups:0,amReviewBacklog:0,clientFeedbackBacklog:0,
  deadlineDays:10,hoursSinceActivity:1
});
assert.equal(healthy.health,'HEALTHY');

const keyA=deterministicAlertKey({ruleCode:'TARGET',entityType:'job',entityId:'j1',ownerUserId:'u1'});
const keyB=deterministicAlertKey({ruleCode:'TARGET',entityType:'job',entityId:'j1',ownerUserId:'u1'});
const keyC=deterministicAlertKey({ruleCode:'TARGET',entityType:'job',entityId:'j1',ownerUserId:'u2'});
assert.equal(keyA,keyB);
assert.notEqual(keyA,keyC);

const actions=nextOperationalActions({
  remainingTarget:2,overdueScreenings:3,qualifiedWaiting:1,amReviewBacklog:2,
  clientFeedbackBacklog:1,pipelineCount:0
});
assert.deepEqual(actions.map(x=>x.code),[
  'CLOSE_TARGET_GAP','COMPLETE_SCREENINGS','SUBMIT_QUALIFIED',
  'CLEAR_AM_BACKLOG','FOLLOW_UP_CLIENT','BUILD_PIPELINE'
]);
assert.ok(actions.every(x=>x.text&&x.why));

const funnel=funnelCounts([
  {stage:'QUALIFIED',sourced:true,screened:true,qualified:true},
  {stage:'CLIENT_SUBMITTED',sourced:true,screened:true,qualified:true,internallySubmitted:true,amApproved:true,clientSubmitted:true},
  {stage:'JOINED',sourced:true,screened:true,qualified:true,internallySubmitted:true,amApproved:true,clientSubmitted:true,shortlisted:true,interviewed:true,offered:true,joined:true}
]);
assert.equal(funnel.sourced,3);
assert.equal(funnel.qualified,3);
assert.equal(funnel.clientSubmitted,2);
assert.equal(funnel.joined,1);

const sources=sourceConversion([
  {source:'LinkedIn',qualified:true,clientSubmitted:true,interviewed:true,offered:false,joined:false},
  {source:'LinkedIn',qualified:false},
  {source:'Referral',qualified:true,clientSubmitted:true,interviewed:true,offered:true,joined:true}
]);
const linkedin=sources.find(x=>x.source==='LINKEDIN');
const referral=sources.find(x=>x.source==='REFERRAL');
assert.equal(linkedin.candidates,2);
assert.equal(linkedin.qualified,1);
assert.equal(referral.joinings,1);

assert.equal(workloadStatus({activeAssignments:1,dailyTarget:1}),'BALANCED');
assert.equal(workloadStatus({activeAssignments:8,dailyTarget:5,pendingScreenings:4,overdueFollowups:3}),'HIGH_LOAD');
assert.equal(workloadStatus({activeAssignments:0,dailyTarget:0}),'LIGHT_LOAD');

console.log('STEP8_MANAGER_UNIT_PASS targets=true health=true severity=true alerts=true funnel=true source=true workload=true');
