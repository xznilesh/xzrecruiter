import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeJdWithProvider } from '../lib/jd-ai.mjs';
import { mockOutputForFixture } from './jd-test-helpers.mjs';

const fixtures=JSON.parse(fs.readFileSync('tests/fixtures/jd-regression.json','utf8'));
assert.ok(fixtures.length>=17);
let passed=0;
for(const fixture of fixtures){
  const result=await analyzeJdWithProvider({
    jdText:fixture.text,
    sourceMeta:{sourceType:'EVAL',version:1},
    callModel:async()=>({id:`eval_${fixture.id}`,model:'recorded-fixture-provider',output_text:JSON.stringify(mockOutputForFixture(fixture))}),
  });
  const data=result.data;const e=fixture.expected||{};
  if(e.title)assert.ok(data.fields.jobTitle.value.toLowerCase().includes(e.title.toLowerCase())||e.title.toLowerCase().includes(data.fields.jobTitle.value.toLowerCase()),`${fixture.id}: title`);
  for(const skill of e.mustSkills||[])assert.ok(data.fields.mandatorySkills.value.some((x)=>x.toLowerCase()===skill.toLowerCase()),`${fixture.id}: must ${skill}`);
  for(const skill of e.niceSkills||[])assert.ok(data.fields.preferredSkills.value.some((x)=>x.toLowerCase()===skill.toLowerCase()),`${fixture.id}: nice ${skill}`);
  if(e.minYears!=null)assert.equal(data.fields.experience.value.minYears,e.minYears,`${fixture.id}: min years`);
  if(e.maxYears!=null)assert.equal(data.fields.experience.value.maxYears,e.maxYears,`${fixture.id}: max years`);
  if(e.city)assert.equal(data.fields.city.value,e.city,`${fixture.id}: city`);
  if(e.workModel)assert.equal(data.fields.workModel.value,e.workModel,`${fixture.id}: work model`);
  if(e.conflict)assert.ok(data.clarifications.some((x)=>x.type==='CONFLICTING'),`${fixture.id}: conflict`);
  if(e.promptInjection)assert.equal(data.inputSafety.promptInjectionDetected,true,`${fixture.id}: injection`);
  for(const hard of data.criteria.filter((x)=>x.kind==='HARD_REQUIREMENT')){
    assert.ok(hard.status==='confirmed_from_jd'||hard.enforcement!=='ACTIVE',`${fixture.id}: invented active hard rule`);
  }
  passed++;
}
console.log(`STEP2_JD_AI_REGRESSION_PASS fixtures=${passed} schema=true must_have=true nice_to_have=true experience=true location=true hard_rule_safety=true ambiguity=true injection=true`);
