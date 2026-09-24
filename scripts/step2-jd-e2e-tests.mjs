import assert from 'node:assert/strict';
import { analyzeJdWithProvider } from '../lib/jd-ai.mjs';
import { validateAiRequirementOutput } from '../lib/jd-contract.mjs';
import { mockOutputForFixture } from './jd-test-helpers.mjs';

const fixture={role:'Salesforce Developer',text:'Salesforce Developer, 4+ years. Platform Developer I certification mandatory. Apex and LWC required. Hyderabad hybrid.',expected:{title:'Salesforce Developer',mustSkills:['Apex','Lightning Web Components'],minYears:4,city:'Hyderabad',workModel:'HYBRID',hardConcepts:['Platform Developer I']}};
const state={requirement:'JD_RECEIVED',source:null,brief:null,recruiterReady:false,audit:[]};
state.source={id:'source-1',version:1,text:fixture.text};state.audit.push('requirement.jd_received');
state.requirement='AI_BRIEF_PENDING';
const analyzed=await analyzeJdWithProvider({jdText:fixture.text,callModel:async()=>({id:'r1',model:'fixture-model',output_text:JSON.stringify(mockOutputForFixture(fixture))})});
state.brief=analyzed.data;state.requirement='AM_REVIEW';state.audit.push('requirement.ai_brief_ready');
assert.equal(state.recruiterReady,false);
state.brief.fields.city.value='Hyderabad';
state.brief.hiringBrief.roleSummary+=' Account Manager reviewed.';
const check=validateAiRequirementOutput(state.brief);assert.equal(check.ok,true,check.errors.join(','));
state.requirement='OPEN';state.recruiterReady=true;state.audit.push('requirement.am_approved','requirement.activated');
assert.equal(state.recruiterReady,true);
assert.deepEqual(state.audit,['requirement.jd_received','requirement.ai_brief_ready','requirement.am_approved','requirement.activated']);

const changedText=fixture.text+' Client changed location to Pune.';
state.source={id:'source-2',version:2,text:changedText};state.requirement='CHANGE_PENDING_AM_CONFIRMATION';state.recruiterReady=false;
assert.equal(state.recruiterReady,false);
console.log('STEP2_JD_E2E_PASS jd_to_ai_to_am_to_recruiter_ready=true material_change_reapproval=true');
