export const CANDIDATE_AI_SCHEMA_VERSION='xz-candidate-ai-v1';
export const CANDIDATE_AI_PROMPT_VERSION='xz-candidate-ai-2026-09-25-v1';

const CONF={type:'number',minimum:0,maximum:1};
const STR={type:'string'};
const EVIDENCE={type:'array',items:{type:'string'},maxItems:12};
const textSignal={
  type:'object',additionalProperties:false,required:['value','confidence','evidence'],
  properties:{value:STR,confidence:CONF,evidence:EVIDENCE}
};
const numberSignal={
  type:'object',additionalProperties:false,required:['value','confidence','evidence'],
  properties:{value:{type:['number','null'],minimum:0,maximum:80},confidence:CONF,evidence:EVIDENCE}
};
const skillItem={
  type:'object',additionalProperties:false,required:['name','estimatedYears','confidence','evidence'],
  properties:{name:STR,estimatedYears:{type:['number','null'],minimum:0,maximum:60},confidence:CONF,evidence:EVIDENCE}
};
const timelineItem={
  type:'object',additionalProperties:false,required:['title','employer','startDate','endDate','location','description','evidence'],
  properties:{title:STR,employer:STR,startDate:STR,endDate:STR,location:STR,description:STR,evidence:EVIDENCE}
};
const educationItem={
  type:'object',additionalProperties:false,required:['degree','institution','graduation','evidence'],
  properties:{degree:STR,institution:STR,graduation:STR,evidence:EVIDENCE}
};
const certificationItem={
  type:'object',additionalProperties:false,required:['name','issuer','date','evidence'],
  properties:{name:STR,issuer:STR,date:STR,evidence:EVIDENCE}
};

export const CANDIDATE_AI_JSON_SCHEMA=Object.freeze({
  type:'object',additionalProperties:false,
  required:['identity','professional','skills','certifications','education','availability','workContext','signals','inputSafety'],
  properties:{
    identity:{
      type:'object',additionalProperties:false,required:['name','email','phone','city','region','countryCode'],
      properties:{name:textSignal,email:textSignal,phone:textSignal,city:textSignal,region:textSignal,countryCode:textSignal}
    },
    professional:{
      type:'object',additionalProperties:false,
      required:['currentTitle','currentCompany','previousTitles','totalExperienceYears','relevantExperienceYears','employmentTimeline','industries'],
      properties:{
        currentTitle:textSignal,currentCompany:textSignal,
        previousTitles:{type:'array',items:STR,maxItems:30},
        totalExperienceYears:numberSignal,relevantExperienceYears:numberSignal,
        employmentTimeline:{type:'array',items:timelineItem,maxItems:50},
        industries:{type:'array',items:STR,maxItems:30},
      }
    },
    skills:{type:'array',items:skillItem,maxItems:120},
    certifications:{type:'array',items:certificationItem,maxItems:40},
    education:{type:'array',items:educationItem,maxItems:30},
    availability:{
      type:'object',additionalProperties:false,required:['status','noticePeriodDays','availabilityDate'],
      properties:{status:textSignal,noticePeriodDays:numberSignal,availabilityDate:textSignal}
    },
    workContext:{
      type:'object',additionalProperties:false,required:['workModel','preferredLocations','workAuthorization'],
      properties:{
        workModel:textSignal,
        preferredLocations:{type:'array',items:STR,maxItems:30},
        workAuthorization:{type:'array',items:STR,maxItems:30},
      }
    },
    signals:{
      type:'object',additionalProperties:false,required:['timelineInconsistencies','missingCriticalInformation','conflicts'],
      properties:{
        timelineInconsistencies:{type:'array',items:STR,maxItems:30},
        missingCriticalInformation:{type:'array',items:STR,maxItems:40},
        conflicts:{type:'array',items:STR,maxItems:30},
      }
    },
    inputSafety:{
      type:'object',additionalProperties:false,required:['promptInjectionDetected','signals'],
      properties:{promptInjectionDetected:{type:'boolean'},signals:{type:'array',items:STR,maxItems:20}}
    }
  }
});

function text(v,max=4000){return String(v??'').replace(/\u0000/g,' ').trim().slice(0,max)}
function clamp(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0}
function num(v,max=80){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=max?n:null}
function uniq(values,max=100){
  const out=[];for(const raw of Array.isArray(values)?values:[]){const v=text(raw,900);if(v&&!out.some(x=>x.toLowerCase()===v.toLowerCase()))out.push(v);if(out.length>=max)break}return out;
}
function sig(v={}){
  return {value:text(v?.value,2000),confidence:clamp(v?.confidence),evidence:uniq(v?.evidence,12)};
}
function nsig(v={}){return {value:num(v?.value),confidence:clamp(v?.confidence),evidence:uniq(v?.evidence,12)}}

export function sanitizeCandidateText(value,maxChars=160000){
  return String(value||'').replace(/\u0000/g,' ').replace(/\r/g,'\n').replace(/[\t\f\v]+/g,' ').replace(/\n{4,}/g,'\n\n\n').trim().slice(0,maxChars);
}

export function normalizeCandidateAiOutput(raw){
  const v=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const id=v.identity||{},pro=v.professional||{},av=v.availability||{},wc=v.workContext||{},sg=v.signals||{};
  return {
    identity:{name:sig(id.name),email:sig(id.email),phone:sig(id.phone),city:sig(id.city),region:sig(id.region),countryCode:sig(id.countryCode)},
    professional:{
      currentTitle:sig(pro.currentTitle),currentCompany:sig(pro.currentCompany),
      previousTitles:uniq(pro.previousTitles,30),totalExperienceYears:nsig(pro.totalExperienceYears),relevantExperienceYears:nsig(pro.relevantExperienceYears),
      employmentTimeline:(Array.isArray(pro.employmentTimeline)?pro.employmentTimeline:[]).slice(0,50).map(x=>({
        title:text(x?.title,500),employer:text(x?.employer,500),startDate:text(x?.startDate,80),endDate:text(x?.endDate,80),location:text(x?.location,500),description:text(x?.description,2500),evidence:uniq(x?.evidence,12)
      })),
      industries:uniq(pro.industries,30)
    },
    skills:(Array.isArray(v.skills)?v.skills:[]).slice(0,120).map(x=>({name:text(x?.name,500),estimatedYears:num(x?.estimatedYears,60),confidence:clamp(x?.confidence),evidence:uniq(x?.evidence,12)})).filter(x=>x.name),
    certifications:(Array.isArray(v.certifications)?v.certifications:[]).slice(0,40).map(x=>({name:text(x?.name,500),issuer:text(x?.issuer,500),date:text(x?.date,100),evidence:uniq(x?.evidence,12)})).filter(x=>x.name),
    education:(Array.isArray(v.education)?v.education:[]).slice(0,30).map(x=>({degree:text(x?.degree,500),institution:text(x?.institution,500),graduation:text(x?.graduation,100),evidence:uniq(x?.evidence,12)})).filter(x=>x.degree||x.institution),
    availability:{status:sig(av.status),noticePeriodDays:nsig(av.noticePeriodDays),availabilityDate:sig(av.availabilityDate)},
    workContext:{workModel:sig(wc.workModel),preferredLocations:uniq(wc.preferredLocations,30),workAuthorization:uniq(wc.workAuthorization,30)},
    signals:{timelineInconsistencies:uniq(sg.timelineInconsistencies,30),missingCriticalInformation:uniq(sg.missingCriticalInformation,40),conflicts:uniq(sg.conflicts,30)},
    inputSafety:{promptInjectionDetected:Boolean(v?.inputSafety?.promptInjectionDetected),signals:uniq(v?.inputSafety?.signals,20)}
  };
}

function validateSignal(name,value,errors){
  if(!value||typeof value!=='object')errors.push(name+':required');
  else if(!Number.isFinite(Number(value.confidence))||value.confidence<0||value.confidence>1)errors.push(name+':confidence');
  else if(!Array.isArray(value.evidence))errors.push(name+':evidence');
}
export function validateCandidateAiOutput(raw){
  const data=normalizeCandidateAiOutput(raw),errors=[];
  for(const [k,v] of Object.entries(data.identity))validateSignal('identity.'+k,v,errors);
  validateSignal('professional.currentTitle',data.professional.currentTitle,errors);
  validateSignal('professional.currentCompany',data.professional.currentCompany,errors);
  validateSignal('professional.totalExperienceYears',data.professional.totalExperienceYears,errors);
  validateSignal('professional.relevantExperienceYears',data.professional.relevantExperienceYears,errors);
  validateSignal('availability.status',data.availability.status,errors);
  validateSignal('availability.noticePeriodDays',data.availability.noticePeriodDays,errors);
  validateSignal('availability.availabilityDate',data.availability.availabilityDate,errors);
  validateSignal('workContext.workModel',data.workContext.workModel,errors);
  for(const [i,s] of data.skills.entries()){
    if(!s.name)errors.push('skills['+i+']:name');
    if(s.estimatedYears!=null&&!Number.isFinite(Number(s.estimatedYears)))errors.push('skills['+i+']:years');
    if(!s.evidence.length&&s.confidence>=0.8)errors.push('skills['+i+']:high_confidence_requires_evidence');
  }
  for(const [i,x] of data.professional.employmentTimeline.entries()){
    if(!x.title&&!x.employer)errors.push('timeline['+i+']:identity');
    if(!x.evidence.length)errors.push('timeline['+i+']:evidence');
  }
  return {ok:errors.length===0,errors,data};
}
