import fs from 'node:fs';
import { analyzeCandidateWithProvider } from '../lib/candidate-ai.mjs';
import { buildCandidateProfileSnapshot,computeCandidateMatch } from '../lib/candidate-intelligence.mjs';

const key=process.env.OPENAI_API_KEY||'';
if(!key){
  console.log('STEP4_CANDIDATE_LIVE_EVAL_BLOCKED missing_OPENAI_API_KEY');
  process.exit(2);
}
const model=process.env.XZRECRUITER_CANDIDATE_MODEL||process.env.XZRECRUITER_JD_MODEL||'gpt-5.6-terra';
const all=JSON.parse(fs.readFileSync('tests/fixtures/candidate-intelligence-regression.json','utf8'));
const wanted=new Set([
  'strong_match','partial_match','mandatory_skill_missing','experience_below','title_diff_skills_fit',
  'remote_location_mismatch','authorization_unknown','availability_unknown','conflicting_timeline',
  'badly_formatted','prompt_injection_resume','technology_once'
]);
const fixtures=all.filter(x=>wanted.has(x.id));

async function provider(request){
  const res=await fetch(process.env.OPENAI_RESPONSES_URL||'https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},
    body:JSON.stringify({...request,model})
  });
  const data=await res.json();
  if(!res.ok)throw new Error('candidate_live_eval_http_'+res.status);
  return data;
}

let schemaValid=0,critical=0,criticalTotal=0,groundedSkills=0,skillTotal=0,promptSafe=0;
for(const fixture of fixtures){
  const result=await analyzeCandidateWithProvider({
    resumeText:fixture.resumeText,candidateProfile:fixture.candidate,
    requirementContext:{jobTitle:fixture.jobTitle,criteria:fixture.criteria},
    model,callModel:provider,maxAttempts:2
  });
  schemaValid++;
  for(const skill of fixture.candidate?.skills||[]){
    criticalTotal++;skillTotal++;
    const hit=result.data.skills.find(x=>x.name.toLowerCase().includes(String(skill).toLowerCase())||String(skill).toLowerCase().includes(x.name.toLowerCase()));
    if(hit){critical++;if(hit.evidence?.length)groundedSkills++}
  }
  if(fixture.candidate?.experience_years!=null){
    criticalTotal++;
    if(result.data.professional.totalExperienceYears.value!=null)critical++;
  }
  if(fixture.expected?.promptInjection){
    criticalTotal++;
    if(result.data.inputSafety.promptInjectionDetected){critical++;promptSafe++}
  }

  const profile=buildCandidateProfileSnapshot({candidate:fixture.candidate,aiExtraction:result.data,resumeText:fixture.resumeText});
  const match=computeCandidateMatch({criteria:fixture.criteria,brief:{fields:{jobTitle:{value:fixture.jobTitle}}},profile});
  if(match.hardRules.some(x=>x.status==='PASS'&&!x.candidateEvidence?.length))throw new Error('ungrounded_hard_rule_pass_'+fixture.id);
  if(match.hardRules.some(x=>x.status==='FAIL'&&!x.candidateEvidence?.length))throw new Error('ungrounded_hard_rule_fail_'+fixture.id);
}

const recall=criticalTotal?critical/criticalTotal:1;
const grounding=skillTotal?groundedSkills/skillTotal:1;
console.log('STEP4_CANDIDATE_LIVE_EVAL_RESULT fixtures='+schemaValid+' critical_recall='+recall.toFixed(3)+' skill_grounding='+grounding.toFixed(3)+' prompt_safe='+promptSafe+' model='+model);
if(recall<.80||grounding<.75)process.exit(1);
