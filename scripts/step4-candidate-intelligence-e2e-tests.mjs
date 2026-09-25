import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  candidateProfileHash,candidateMatchIdempotencyKey,evaluateDuplicatePair
} from '../lib/candidate-intelligence.mjs';
import { analyzeCandidateWithProvider } from '../lib/candidate-ai.mjs';
import { aiOutputForFixture,loadFixtures,matchForFixture,profileForFixture } from './step4-candidate-intelligence-test-helpers.mjs';

const fixtures=loadFixtures();
const strong=fixtures.find(x=>x.id==='strong_match');
const hardFail=fixtures.find(x=>x.id==='experience_below');
const hardUnknown=fixtures.find(x=>x.id==='authorization_unknown');
const duplicateFixture=fixtures.find(x=>x.id==='duplicate_resume');

const strongResult=matchForFixture(strong);
assert.equal(strongResult.match.hardRuleStatus,'PASS');
assert.equal(strongResult.match.band,'Strong Match');
assert.ok(strongResult.match.strengths.length>0);
assert.ok(strongResult.match.evidenceMeta.scoreIsDecision===false);

const failResult=matchForFixture(hardFail);
assert.equal(failResult.match.hardRuleStatus,'FAIL');
assert.equal(failResult.match.band,'Mandatory Requirement Missing');

const unknownResult=matchForFixture(hardUnknown);
assert.equal(unknownResult.match.hardRuleStatus,'UNKNOWN');
assert.notEqual(unknownResult.match.recommendation,'WORTH_SCREENING');

const dup=evaluateDuplicatePair(duplicateFixture.candidate,duplicateFixture.duplicate);
assert.equal(dup.status,'exact_duplicate');
assert.ok(dup.signals.length>0);

const originalProfile=profileForFixture(strong);
const updatedProfile=structuredClone(originalProfile);
updatedProfile.professional.currentTitle.original='Principal Backend Engineer';
assert.notEqual(candidateProfileHash(originalProfile),candidateProfileHash(updatedProfile),'material profile change must change version hash');

const baseKey=candidateMatchIdempotencyKey({agencyId:'a',jobId:'job-a',candidateId:'cand',briefId:'brief-v1',profileHash:candidateProfileHash(originalProfile),scoringVersion:'score-v2'});
const sameKey=candidateMatchIdempotencyKey({agencyId:'a',jobId:'job-a',candidateId:'cand',briefId:'brief-v1',profileHash:candidateProfileHash(originalProfile),scoringVersion:'score-v2'});
const changedResumeKey=candidateMatchIdempotencyKey({agencyId:'a',jobId:'job-a',candidateId:'cand',briefId:'brief-v1',profileHash:candidateProfileHash(updatedProfile),scoringVersion:'score-v2'});
const changedReqKey=candidateMatchIdempotencyKey({agencyId:'a',jobId:'job-a',candidateId:'cand',briefId:'brief-v2',profileHash:candidateProfileHash(originalProfile),scoringVersion:'score-v2'});
const secondRequirementKey=candidateMatchIdempotencyKey({agencyId:'a',jobId:'job-b',candidateId:'cand',briefId:'brief-b',profileHash:candidateProfileHash(originalProfile),scoringVersion:'score-v2'});
assert.equal(baseKey,sameKey);
assert.notEqual(baseKey,changedResumeKey);
assert.notEqual(baseKey,changedReqKey);
assert.notEqual(baseKey,secondRequirementKey);

let attempts=0;
const ai=await analyzeCandidateWithProvider({
  resumeText:strong.resumeText,candidateProfile:strong.candidate,
  requirementContext:{jobTitle:strong.jobTitle,criteria:strong.criteria},
  model:'fixture-model',maxAttempts:2,
  callModel:async()=>{
    attempts++;
    if(attempts===1)return {id:'bad',model:'fixture-model',output_text:'not-json'};
    return {id:'ok',model:'fixture-model',output_text:JSON.stringify(aiOutputForFixture(strong)),usage:{input_tokens:100,output_tokens:50}};
  }
});
assert.equal(attempts,2,'AI malformed output should retry safely');
assert.equal(ai.data.identity.name.value,strong.candidate.full_name);
assert.ok(ai.providerResponseId==='ok');

const ui=fs.readFileSync('app/components/CandidateIntelligenceWorkspace.js','utf8');
const api=fs.readFileSync('app/api/candidate-intelligence/route.js','utf8');
assert.ok(ui.includes('Approved hard-rule check'));
assert.ok(ui.includes('Must-have check'));
assert.ok(ui.includes('Strengths')&&ui.includes('Gaps')&&ui.includes('Risks / uncertainties'));
assert.ok(ui.includes('Potential duplicate evidence'));
assert.ok(ui.includes('Previous intelligence'));
assert.ok(ui.includes('Mark ready for human screening'));
assert.ok(ui.includes('Step 5 screening itself is not performed here.'));
assert.ok(api.includes("action==='review'"));
assert.ok(!/generateScreening|screeningQuestions|aiScreeningRecommendation/.test(api),'Step 5 must not be implemented in Step 4');

console.log('STEP4_CANDIDATE_E2E_PASS strong=true possible_unknown=true hard_fail=true duplicate=true retry=true stale_keys=true multi_requirement=true human_handoff_only=true');
