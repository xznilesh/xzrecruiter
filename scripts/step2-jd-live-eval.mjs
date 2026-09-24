import fs from 'node:fs';
import { analyzeJdWithProvider } from '../lib/jd-ai.mjs';

const key=process.env.OPENAI_API_KEY||'';
if(!key){
  console.log('STEP2_JD_LIVE_EVAL_BLOCKED missing_OPENAI_API_KEY');
  process.exit(2);
}
const model=process.env.XZRECRUITER_JD_MODEL||'gpt-5.6-terra';
const fixtures=JSON.parse(fs.readFileSync('tests/fixtures/jd-regression.json','utf8')).slice(0,17);
async function provider(request){
  const res=await fetch(process.env.OPENAI_RESPONSES_URL||'https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({...request,model})});
  const data=await res.json();
  if(!res.ok)throw new Error(`live_eval_http_${res.status}`);
  return data;
}
let schema=0,critical=0,totalCritical=0;
for(const fixture of fixtures){
  const result=await analyzeJdWithProvider({jdText:fixture.text,callModel:provider,model});
  schema++;
  const e=fixture.expected||{};
  for(const skill of e.mustSkills||[]){totalCritical++;if(result.data.fields.mandatorySkills.value.some((x)=>x.toLowerCase().includes(skill.toLowerCase())))critical++}
  if(e.minYears!=null){totalCritical++;if(result.data.fields.experience.value.minYears===e.minYears)critical++}
  if(e.city){totalCritical++;if(result.data.fields.city.value.toLowerCase().includes(e.city.toLowerCase()))critical++}
  if(e.promptInjection){totalCritical++;if(result.data.inputSafety.promptInjectionDetected)critical++}
}
const recall=totalCritical?critical/totalCritical:1;
console.log(`STEP2_JD_LIVE_EVAL_RESULT fixtures=${schema} critical_recall=${recall.toFixed(3)} model=${model}`);
if(recall<0.85)process.exit(1);
