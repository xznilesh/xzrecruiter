import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AmDecision, Provenance, ReturnReason, assertNoAiVerificationUpgrade, buildClientFacingSubmission,
  buildSubmissionPack, clientContentLeaksInternalData, detectSubmissionPromptInjectionSignals,
  submissionEligibility, validateAmDecision
} from '../lib/submission-pack.mjs';

const fixtures = JSON.parse(await readFile(new URL('../tests/fixtures/submission-pack-regression.json', import.meta.url)));
const base = {
  application:{id:'a1',candidacyState:'QUALIFIED'},
  job:{id:'j1',title:'Senior Backend Engineer'},
  requirement:{id:'b1',versionNumber:4},
  criteria:[], configuration:{}, compliance:{satisfied:true}, commercial:{},
};

for (const fixture of fixtures) {
  const input={...base,...fixture,application:{...base.application,...fixture.application}};
  const eligibility=submissionEligibility(input);
  assert.equal(eligibility.eligible,true,fixture.name+' should remain submission eligible');
  const pack=buildSubmissionPack(input,{now:'2026-09-25T02:00:00.000Z'});
  assert.equal(pack.eligibility.eligible,true);
  assert.ok(pack.sourceFingerprint.length===64);
  assert.equal(pack.candidateSummary.facts.name.value,fixture.candidate.fullName);
  const client=buildClientFacingSubmission(pack,{includeCompensation:false,submissionVersion:1});
  assert.equal(clientContentLeaksInternalData(client),false,fixture.name+' leaked internal fields');
  assert.equal(JSON.stringify(client).includes('commercialInternal'),false);
}

const unknown=buildSubmissionPack({...base,...fixtures.find(x=>x.name==='unknown-availability-salary')});
assert.equal(unknown.availability.availability.provenance,Provenance.UNKNOWN);
assert.equal(unknown.compensation.value,null);

const correction=buildSubmissionPack({...base,...fixtures.find(x=>x.name==='candidate-declared-correction')});
assert.equal(correction.availability.noticePeriodDays.value,30);
assert.equal(correction.availability.noticePeriodDays.provenance,Provenance.CANDIDATE_DECLARED);

const conflict=buildSubmissionPack({...base,...fixtures.find(x=>x.name==='conflicting-experience')});
assert.equal(conflict.conflicts.length,1);
assert.equal(conflict.conflicts[0].values.length,2);

const maliciousResume=fixtures.find(x=>x.name==='malicious-resume');
assert.ok(detectSubmissionPromptInjectionSignals(maliciousResume.rawResumeText).length>=2);
assert.ok(submissionEligibility({...base,...maliciousResume}).warnings.includes('UNTRUSTED_RESUME_INSTRUCTION_SIGNAL'));
const maliciousNote=fixtures.find(x=>x.name==='malicious-recruiter-note');
assert.ok(submissionEligibility({...base,...maliciousNote}).warnings.includes('UNTRUSTED_NOTE_INSTRUCTION_SIGNAL'));

assert.throws(()=>assertNoAiVerificationUpgrade(
  {value:'AWS',provenance:Provenance.AI_DERIVED,evidence:[]},
  {value:'AWS',provenance:Provenance.RECRUITER_VERIFIED,evidence:[]}
),/cannot become VERIFIED/);
assert.doesNotThrow(()=>assertNoAiVerificationUpgrade(
  {value:'AWS',provenance:Provenance.AI_DERIVED,evidence:[]},
  {value:'AWS',provenance:Provenance.RECRUITER_VERIFIED,evidence:['Recruiter call']}
));

assert.deepEqual(validateAmDecision({action:AmDecision.APPROVE}),{ok:true});
assert.equal(validateAmDecision({action:AmDecision.RETURN_TO_RECRUITER}).ok,false);
assert.deepEqual(validateAmDecision({action:AmDecision.RETURN_TO_RECRUITER,reasonCode:ReturnReason.RESUME_ISSUE}),{ok:true});
assert.equal(validateAmDecision({action:AmDecision.ON_HOLD}).ok,false);
assert.equal(validateAmDecision({action:AmDecision.ON_HOLD,note:'Awaiting client clarification'}).ok,true);

const badCases=[
  [{...base.application,candidacyState:'SCREENING'},'CANDIDATE_NOT_QUALIFIED'],
];
for(const [application,reason] of badCases){
  const r=submissionEligibility({...base,...fixtures[0],application});
  assert.equal(r.eligible,false);assert.ok(r.reasons.includes(reason));
}
for(const [patch,reason] of [
  [{screening:{...fixtures[0].screening,state:'IN_PROGRESS'}},'SCREENING_NOT_QUALIFIED'],
  [{screening:{...fixtures[0].screening,interestConfirmed:false}},'CANDIDATE_INTEREST_NOT_CONFIRMED'],
  [{match:{...fixtures[0].match,run_status:'STALE'}},'CURRENT_CANDIDATE_INTELLIGENCE_REQUIRED'],
  [{resume:{}},'PRIMARY_RESUME_REQUIRED'],
]){
  const r=submissionEligibility({...base,...fixtures[0],...patch});
  assert.equal(r.eligible,false);assert.ok(r.reasons.some(x=>x.startsWith(reason)),reason);
}

console.log(`Step 6 submission unit tests passed (${fixtures.length} AI-regression fixtures).`);
