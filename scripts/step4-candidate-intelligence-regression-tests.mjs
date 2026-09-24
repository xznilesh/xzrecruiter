import assert from 'node:assert/strict';
import {
  normalizeSkill
} from '../lib/candidate-intelligence.mjs';
import { validateCandidateAiOutput } from '../lib/candidate-ai-contract.mjs';
import {
  aiOutputForFixture,duplicateForFixture,loadFixtures,matchForFixture
} from './step4-candidate-intelligence-test-helpers.mjs';

const fixtures=loadFixtures();
assert.ok(fixtures.length>=22,'permanent regression set must contain at least 22 scenarios');

let schemaValid=0,expectedChecks=0,expectedPassed=0,grounded=0,groundable=0;
let falseHardFailures=0,hallucinatedPasses=0,consistent=0,duplicateChecks=0,duplicatePassed=0;
let explanationRows=0,explanationGood=0;

for(const fixture of fixtures){
  const schema=validateCandidateAiOutput(aiOutputForFixture(fixture));
  if(schema.ok)schemaValid++;

  const first=matchForFixture(fixture);
  const second=matchForFixture(fixture);
  if(JSON.stringify(first.match)===JSON.stringify(second.match))consistent++;

  const exp=fixture.expected||{};
  if(exp.hardRuleStatus){expectedChecks++;if(first.match.hardRuleStatus===exp.hardRuleStatus)expectedPassed++}
  if(exp.band){expectedChecks++;if(first.match.band===exp.band)expectedPassed++}
  if(typeof exp.promptInjection==='boolean'){expectedChecks++;if(Boolean(first.profile.signals.promptInjectionDetected)===exp.promptInjection)expectedPassed++}
  if(exp.hasUncertainty){expectedChecks++;if(first.match.uncertainties.length>0)expectedPassed++}
  if(exp.falseHardRuleFailurePrevented){expectedChecks++;if(first.match.hardRuleStatus!=='FAIL')expectedPassed++}

  for(const rule of first.match.hardRules){
    if(['PASS','FAIL'].includes(rule.status)){
      groundable++;
      if(Array.isArray(rule.candidateEvidence)&&rule.candidateEvidence.length>0)grounded++;
    }
    if(rule.status==='FAIL'&&/(skill|technology|tool|certification|license)/i.test(rule.field||''))falseHardFailures++;
    if(rule.status==='PASS'&&/(skill|technology|tool)/i.test(rule.field||'')){
      const required=normalizeSkill(rule.requirement);
      if(!first.profile.skills.some(x=>x.normalized===required))hallucinatedPasses++;
    }
    explanationRows++;
    if(String(rule.reason||'').length>=20)explanationGood++;
  }

  for(const result of first.match.requirementResults){
    if(result.status==='PASS'&&/(skill|technology|tool)/i.test(result.field||'')){
      const required=normalizeSkill(result.requirement);
      if(!first.profile.skills.some(x=>x.normalized===required))hallucinatedPasses++;
    }
    explanationRows++;
    if(String(result.reason||'').length>=20)explanationGood++;
  }

  for(const row of [...first.match.strengths,...first.match.gaps,...first.match.uncertainties]){
    explanationRows++;
    if(String(row.reason||'').length>=15)explanationGood++;
  }

  if(exp.duplicateStatus){
    duplicateChecks++;
    const duplicate=duplicateForFixture(fixture);
    if(duplicate?.status===exp.duplicateStatus)duplicatePassed++;
  }
}

const schemaRate=schemaValid/fixtures.length;
const expectedRate=expectedChecks?expectedPassed/expectedChecks:1;
const groundingRate=groundable?grounded/groundable:1;
const consistencyRate=consistent/fixtures.length;
const duplicateRate=duplicateChecks?duplicatePassed/duplicateChecks:1;
const explanationRate=explanationRows?explanationGood/explanationRows:1;

assert.equal(schemaRate,1,'AI fixture schema validity must be 100%');
assert.equal(expectedRate,1,'critical fixture expectations must be 100%');
assert.equal(falseHardFailures,0,'absence-only skill/cert evidence must never cause hard FAIL');
assert.equal(hallucinatedPasses,0,'skill PASS must always map to candidate skill evidence');
assert.ok(groundingRate>=.95,'PASS/FAIL hard-rule evidence grounding must be >=95%');
assert.equal(consistencyRate,1,'deterministic reruns must be 100% consistent');
assert.equal(duplicateRate,1,'fixture duplicate accuracy must be 100%');
assert.ok(explanationRate>=.95,'explanation quality baseline must be >=95%');

const auth=fixtures.find(x=>x.id==='authorization_unknown');
const availability=fixtures.find(x=>x.id==='availability_unknown');
assert.equal(matchForFixture(auth).match.hardRuleStatus,'UNKNOWN');
assert.equal(matchForFixture(availability).match.hardRuleStatus,'UNKNOWN');

console.log(
  'STEP4_CANDIDATE_AI_REGRESSION_PASS fixtures='+fixtures.length+
  ' schema_validity='+schemaRate.toFixed(3)+
  ' critical_expectations='+expectedRate.toFixed(3)+
  ' false_hard_failure_rate='+(falseHardFailures/Math.max(1,fixtures.length)).toFixed(3)+
  ' hallucinated_passes='+hallucinatedPasses+
  ' evidence_grounding='+groundingRate.toFixed(3)+
  ' duplicate_accuracy='+duplicateRate.toFixed(3)+
  ' consistency='+consistencyRate.toFixed(3)+
  ' explanation_quality='+explanationRate.toFixed(3)
);
