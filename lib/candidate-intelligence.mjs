import { createHash } from 'node:crypto';

export const CANDIDATE_PROFILE_SCHEMA_VERSION='xz-candidate-profile-v1';
export const CANDIDATE_MATCH_SCHEMA_VERSION='xz-candidate-match-v1';
export const CANDIDATE_PROMPT_VERSION='xz-candidate-intelligence-2026-09-25-v1';
export const SCORING_CONFIG_VERSION='xz-candidate-score-2026-09-25-v1';

export const BASELINE_WEIGHTS=Object.freeze({
  mandatorySkills:35,experienceFit:15,titleDomain:10,locationWorkModel:10,
  workAuthorization:15,availability:5,preferredSkills:5,profileConsistency:5,
});

const SKILL_ALIASES=new Map(Object.entries({
  node:'node.js',nodejs:'node.js','node js':'node.js','node.js':'node.js',
  js:'javascript',javascript:'javascript',ts:'typescript',typescript:'typescript',
  reactjs:'react','react.js':'react',react:'react',nextjs:'next.js','next js':'next.js','next.js':'next.js',
  postgres:'postgresql',postgresql:'postgresql',springboot:'spring boot','spring-boot':'spring boot','spring boot':'spring boot',
  dotnet:'.net','.net':'.net',k8s:'kubernetes',kubernetes:'kubernetes',gcp:'google cloud platform',
  'google cloud':'google cloud platform','google cloud platform':'google cloud platform',aws:'amazon web services',
  'amazon web services':'amazon web services',powerbi:'power bi','power bi':'power bi',lwc:'lightning web components',
  'lightning web components':'lightning web components',
}));

const TITLE_ALIASES=new Map(Object.entries({
  'software developer':'software engineer','software engineer':'software engineer','sde':'software engineer',
  'backend developer':'backend engineer','back end developer':'backend engineer','backend engineer':'backend engineer',
  'front end developer':'frontend engineer','frontend developer':'frontend engineer','frontend engineer':'frontend engineer',
  'full stack developer':'full stack engineer','full-stack developer':'full stack engineer','full stack engineer':'full stack engineer',
}));

function txt(v,max=4000){return String(v??'').replace(/\u0000/g,' ').trim().slice(0,max)}
function low(v){return txt(v).toLowerCase()}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function clamp(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0}
function aiValue(v){return v&&typeof v==='object'&&'value' in v?v.value:v}
function aiConfidence(v,fallback=0){return v&&typeof v==='object'&&'confidence' in v?v.confidence:fallback}
function aiEvidence(v){return v&&typeof v==='object'&&Array.isArray(v.evidence)?v.evidence:[]}
function uniq(values,max=100){
  const out=[];
  for(const raw of Array.isArray(values)?values:[]){
    const value=txt(typeof raw==='string'?raw:(raw?.value??raw?.name??raw?.text??raw?.label??''),500);
    if(value&&!out.some(x=>x.toLowerCase()===value.toLowerCase()))out.push(value);
    if(out.length>=max)break;
  }
  return out;
}
function f(original,normalized,confidence,evidence=[],source='PROFILE',status='ORIGINAL'){
  return {original:original??'',normalized:normalized??original??'',confidence:clamp(confidence),evidence:uniq(evidence,12),source:txt(source,80),normalizationStatus:status};
}

export function normalizeEmail(v){return low(v).replace(/\s+/g,'')}
export function normalizePhone(v){const raw=txt(v,80);const digits=raw.replace(/\D/g,'');return digits?(raw.startsWith('+')?'+':'')+digits:''}
export function normalizeSkill(v){const raw=low(v).replace(/[_]+/g,' ').replace(/\s+/g,' ').trim();return SKILL_ALIASES.get(raw)||raw}
export function normalizeTitle(v){const raw=low(v).replace(/[|,/]+/g,' ').replace(/\s+/g,' ').trim();return TITLE_ALIASES.get(raw)||raw}
export function normalizeLocation(v){return low(v).replace(/[.,]+/g,' ').replace(/\s+/g,' ').trim()}
export function normalizeCertification(v){return low(v).replace(/[®™]/g,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim()}
export function normalizeSourceUrl(v){
  const raw=txt(v,1200);if(!raw)return '';
  try{const u=new URL(raw);u.hash='';u.search='';return u.toString().replace(/\/$/,'').toLowerCase()}catch{return low(raw)}
}
export function normalizeSkillList(values){
  const out=[];
  for(const original of uniq(values,120)){
    const normalized=normalizeSkill(original);
    if(normalized&&!out.some(x=>x.normalized===normalized))out.push({original,normalized});
  }
  return out;
}

export function detectCandidatePromptInjectionSignals(value){
  const source=String(value||'');
  const patterns=[
    /ignore\s+(?:(?:all|any|the)\s+)?(?:(?:previous|prior)\s+)?(?:(?:system|developer)\s+)?instructions?/ig,
    /reveal (?:the )?(?:system|developer) prompt/ig,/print (?:your )?(?:secrets?|api keys?|credentials?)/ig,
    /mark me (?:100%|one hundred percent) fit/ig,/approve me|auto[- ]?approve/ig,
    /override (?:the )?(?:hard rules?|scoring|system|developer)/ig,/BEGIN SYSTEM PROMPT/ig,
  ];
  const hits=[];
  for(const p of patterns)for(const m of source.matchAll(p)){
    const v=txt(m[0],180);if(v&&!hits.some(x=>x.toLowerCase()===v.toLowerCase()))hits.push(v);
    if(hits.length>=20)return hits;
  }
  return hits;
}

function parsedDate(v){
  const raw=txt(v,80);if(!raw)return null;
  if(/^(present|current|now)$/i.test(raw))return 'PRESENT';
  const d=new Date(raw);return Number.isNaN(d.getTime())?null:d;
}
export function calculateExperienceYears(timeline=[],now=new Date()){
  const intervals=[];
  for(const item of Array.isArray(timeline)?timeline:[]){
    const start=parsedDate(item?.startDate||item?.start||'');
    const end=parsedDate(item?.endDate||item?.end||'');
    if(!(start instanceof Date))continue;
    const finish=end==='PRESENT'?now:end instanceof Date?end:null;
    if(finish&&finish>=start)intervals.push([start.getTime(),Math.min(finish.getTime(),now.getTime())]);
  }
  intervals.sort((a,b)=>a[0]-b[0]);const merged=[];
  for(const cur of intervals){const last=merged.at(-1);if(!last||cur[0]>last[1])merged.push([...cur]);else last[1]=Math.max(last[1],cur[1])}
  if(!merged.length)return null;
  const ms=merged.reduce((s,x)=>s+Math.max(0,x[1]-x[0]),0);
  return Math.round(ms/(365.2425*86400000)*10)/10;
}
function normalizedItems(values,normalizer){
  const out=[];
  for(const raw of Array.isArray(values)?values:[]){
    const original=txt(typeof raw==='string'?raw:(raw?.original??raw?.value??raw?.name??raw?.text??''),500);
    if(!original)continue;
    const normalized=normalizer(raw?.normalized??original);
    if(!normalized||out.some(x=>x.normalized===normalized))continue;
    out.push({original,normalized,confidence:clamp(raw?.confidence??0.7),evidence:uniq(raw?.evidence||[],8),source:txt(raw?.source||'PROFILE',80),normalizationStatus:normalized===low(original)?'UNCHANGED':'NORMALIZED',estimatedYears:num(raw?.estimatedYears)});
  }
  return out;
}

export function buildCandidateProfileSnapshot({candidate={},parseRun={},aiExtraction={},resumeText=''}={}){
  const extracted=parseRun?.extracted_data||parseRun?.extractedData||{};
  const confidence=parseRun?.field_confidence||parseRun?.fieldConfidence||{};
  const evidence=parseRun?.field_evidence||parseRun?.fieldEvidence||{};
  const ai=aiExtraction||{};
  const name=candidate.full_name||candidate.fullName||aiValue(ai?.identity?.name)||extracted.fullName||'';
  const email=candidate.email||aiValue(ai?.identity?.email)||extracted.email||'';
  const phone=candidate.phone||aiValue(ai?.identity?.phone)||extracted.phone||'';
  const title=candidate.current_title||candidate.currentTitle||aiValue(ai?.professional?.currentTitle)||extracted.currentTitle||extracted.headline||'';
  const company=candidate.current_company||candidate.currentCompany||aiValue(ai?.professional?.currentCompany)||'';
  const location=[candidate.city||aiValue(ai?.identity?.city)||'',candidate.region||aiValue(ai?.identity?.region)||'',candidate.country_code||aiValue(ai?.identity?.countryCode)||''].filter(Boolean).join(', ');
  const timeline=Array.isArray(ai?.professional?.employmentTimeline)?ai.professional.employmentTimeline:[];
  const totalExp=num(candidate.experience_years??candidate.experienceYears??aiValue(ai?.professional?.totalExperienceYears)??extracted.experienceYears??calculateExperienceYears(timeline));
  const relevantExp=num(candidate.relevant_experience_years??candidate.relevantExperienceYears??aiValue(ai?.professional?.relevantExperienceYears));
  const skills=normalizedItems([...(candidate.skills||[]),...(extracted.skills||[]),...(ai.skills||[])],normalizeSkill);
  const certs=normalizedItems([...(candidate.certifications||[]),...(ai.certifications||[])],normalizeCertification);
  const previousTitles=normalizedItems(ai?.professional?.previousTitles||[],normalizeTitle);
  const industries=normalizedItems(ai?.professional?.industries||[],normalizeLocation);
  const education=(Array.isArray(ai?.education)&&ai.education.length?ai.education:(candidate.education||extracted.education||[])).slice(0,30);
  const auth=uniq(candidate.work_authorization_summary||candidate.workAuthorizationSummary||ai?.workContext?.workAuthorization||[],20);
  const desired=uniq(candidate.desired_locations||candidate.desiredLocations||ai?.workContext?.preferredLocations||[],20);
  const availability=txt(candidate.availability_status||candidate.availabilityStatus||aiValue(ai?.availability?.status)||'UNKNOWN',80).toUpperCase();
  const notice=num(candidate.notice_period_days??candidate.noticePeriodDays??aiValue(ai?.availability?.noticePeriodDays));
  const availabilityDate=txt(aiValue(ai?.availability?.availabilityDate)||'',80);
  const workModel=txt(candidate.workplace_preference||candidate.workplacePreference||aiValue(ai?.workContext?.workModel)||'',80).toUpperCase();
  const rawResume=String(resumeText||parseRun?.extracted_text||'');
  const injection=detectCandidatePromptInjectionSignals(rawResume);
  return {
    identity:{
      name:f(name,low(name),name?(confidence.fullName??0.95):0,evidence.fullName?[evidence.fullName]:[],candidate.full_name?'PROFILE':aiValue(ai?.identity?.name)?'AI_EXTRACTION':'RESUME_PARSE','NORMALIZED'),
      email:f(email,normalizeEmail(email),email?(confidence.email??0.99):0,evidence.email?[evidence.email]:[],candidate.email?'PROFILE':aiValue(ai?.identity?.email)?'AI_EXTRACTION':'RESUME_PARSE','NORMALIZED'),
      phone:f(phone,normalizePhone(phone),phone?(confidence.phone??0.9):0,evidence.phone?[evidence.phone]:[],candidate.phone?'PROFILE':aiValue(ai?.identity?.phone)?'AI_EXTRACTION':'RESUME_PARSE','NORMALIZED'),
      location:f(location,normalizeLocation(location),location?0.8:0,[...aiEvidence(ai?.identity?.city),...aiEvidence(ai?.identity?.region),...aiEvidence(ai?.identity?.countryCode)],candidate.city||candidate.country_code?'PROFILE':aiValue(ai?.identity?.city)?'AI_EXTRACTION':'UNKNOWN','NORMALIZED'),
    },
    professional:{
      currentTitle:f(title,normalizeTitle(title),title?(confidence.currentTitle??0.8):0,evidence.currentTitle?[evidence.currentTitle]:[],candidate.current_title?'PROFILE':aiValue(ai?.professional?.currentTitle)?'AI_EXTRACTION':'RESUME_PARSE','NORMALIZED'),
      currentCompany:f(company,low(company),company?0.8:0,aiEvidence(ai?.professional?.currentCompany),candidate.current_company?'PROFILE':aiValue(ai?.professional?.currentCompany)?'AI_EXTRACTION':'UNKNOWN','NORMALIZED'),
      previousTitles,totalExperienceYears:f(totalExp??'',totalExp??'',totalExp!=null?(confidence.experienceYears??0.75):0,evidence.experienceYears?[evidence.experienceYears]:[],candidate.experience_years!=null?'PROFILE':aiValue(ai?.professional?.totalExperienceYears)!=null?'AI_EXTRACTION':'RESUME_PARSE','CALCULATED_OR_NORMALIZED'),
      relevantExperienceYears:f(relevantExp??'',relevantExp??'',relevantExp!=null?0.7:0,aiEvidence(ai?.professional?.relevantExperienceYears),candidate.relevant_experience_years!=null?'PROFILE':aiValue(ai?.professional?.relevantExperienceYears)!=null?'AI_EXTRACTION':'UNKNOWN','CALCULATED_OR_NORMALIZED'),
      employmentTimeline:timeline.slice(0,50),industries,
    },
    skills,certifications:certs,education,
    availability:{
      status:f(availability,availability,availability&&availability!=='UNKNOWN'?0.9:0.2,[],candidate.availability_status?'PROFILE':aiValue(ai?.availability?.status)?'AI_EXTRACTION':'UNKNOWN'),
      noticePeriodDays:f(notice??'',notice??'',notice!=null?0.9:0,[],candidate.notice_period_days!=null?'PROFILE':aiValue(ai?.availability?.noticePeriodDays)!=null?'AI_EXTRACTION':'UNKNOWN'),
      availabilityDate:f(availabilityDate,availabilityDate,availabilityDate?0.8:0,[],availabilityDate?'AI_EXTRACTION':'UNKNOWN'),
    },
    workContext:{
      workplacePreference:f(workModel,workModel,workModel?0.9:0,[],candidate.workplace_preference?'PROFILE':aiValue(ai?.workContext?.workModel)?'AI_EXTRACTION':'UNKNOWN'),
      preferredLocations:desired.map(x=>({original:x,normalized:normalizeLocation(x)})),
      workAuthorization:auth.map(x=>({original:x,normalized:low(x)})),
    },
    signals:{
      timelineInconsistencies:uniq(ai?.signals?.timelineInconsistencies||[],20),
      missingCriticalInformation:uniq(ai?.signals?.missingCriticalInformation||[],30),
      conflicts:uniq(ai?.signals?.conflicts||[],20),
      promptInjectionDetected:injection.length>0,promptInjectionSignals:injection,
    },
    source:{
      candidateId:txt(candidate.id,80),parseRunId:txt(parseRun.id,80),documentId:txt(parseRun.document_id||parseRun.documentId,80),
      documentVersion:num(parseRun.document_version||parseRun.documentVersion),parserVersion:txt(parseRun.parser_version||parseRun.parserVersion,120),
      resumeTextHash:createHash('sha256').update(rawResume).digest('hex'),
    },
  };
}

export function candidateProfileHash(profile){return createHash('sha256').update(JSON.stringify(profile||{})).digest('hex')}

export function evaluateDuplicatePair(a,b){
  const signals=[];let score=0;
  const add=(ok,type,weight,evidence)=>{if(ok){score+=weight;signals.push({type,weight,evidence:uniq(evidence,5)})}};
  const ae=normalizeEmail(a?.identity?.email?.normalized||a?.email||''),be=normalizeEmail(b?.identity?.email?.normalized||b?.email||'');
  const ap=normalizePhone(a?.identity?.phone?.normalized||a?.phone||''),bp=normalizePhone(b?.identity?.phone?.normalized||b?.phone||'');
  const au=normalizeSourceUrl(a?.sourceReference||a?.source_reference||''),bu=normalizeSourceUrl(b?.sourceReference||b?.source_reference||'');
  const an=low(a?.identity?.name?.normalized||a?.full_name||a?.fullName||''),bn=low(b?.identity?.name?.normalized||b?.full_name||b?.fullName||'');
  const ac=low(a?.professional?.currentCompany?.normalized||a?.current_company||a?.currentCompany||''),bc=low(b?.professional?.currentCompany?.normalized||b?.current_company||b?.currentCompany||'');
  const al=normalizeLocation(a?.identity?.location?.normalized||a?.city||''),bl=normalizeLocation(b?.identity?.location?.normalized||b?.city||'');
  const ar=txt(a?.resumeChecksum||a?.checksum||''),br=txt(b?.resumeChecksum||b?.checksum||'');
  add(ae&&ae===be,'EXACT_EMAIL',100,[ae]);add(ap&&ap===bp,'EXACT_PHONE',100,[ap]);add(au&&au===bu,'EXACT_SOURCE_URL',90,[au]);
  add(an&&an===bn&&ac&&ac===bc,'NAME_EMPLOYER',45,[an,ac]);add(an&&an===bn&&al&&al===bl,'NAME_LOCATION',35,[an,al]);add(ar&&ar===br,'EXACT_RESUME',100,[ar]);
  return {status:score>=100?'exact_duplicate':score>=70?'likely_duplicate':score>=35?'possible_duplicate':'no_duplicate_signal',score:Math.min(100,score),signals};
}

function criterionKind(c){return c?.criterion_kind??c?.kind}
function criterionValue(c){return txt(c?.value_text??c?.value??'',1000)}
function criterionField(c){return low(c?.field_key??c?.field??'')}
function criterionEvidence(c){return uniq(c?.evidence||[],10)}
function firstNumber(v){const m=String(v||'').match(/(\d+(?:\.\d+)?)/);return m?Number(m[1]):null}
function contains(a,b){const x=low(a),y=low(b);return Boolean(x&&y&&(x.includes(y)||y.split(/\s+/).filter(t=>t.length>2).every(t=>x.includes(t))))}
function skillHit(profile,required){
  const n=normalizeSkill(required);const h=(profile?.skills||[]).find(x=>x.normalized===n);
  return h?{matched:true,evidence:h.evidence.length?h.evidence:[h.original],confidence:h.confidence}:null;
}
export function evaluateHardRule(rule,profile){
  const requirement=criterionValue(rule),key=criterionField(rule);
  const base={requirement,field:key,status:'UNKNOWN',candidateEvidence:[],reason:'Candidate evidence is insufficient to evaluate this confirmed hard requirement.',confidence:0.2,requirementEvidence:criterionEvidence(rule)};
  if(!requirement)return base;
  if(/skill|technology|tool/.test(key)){
    const pieces=requirement.split(/[,/|;+]|\band\b/i).map(x=>x.trim()).filter(Boolean),availableSkills=profile?.skills||[];
    if(!availableSkills.length)return {...base,reason:'No usable candidate skill evidence is available; the hard requirement remains unknown.',confidence:0.15};
    const hits=pieces.map(x=>skillHit(profile,x)).filter(Boolean);
    if(pieces.length&&hits.length===pieces.length)return {...base,status:'PASS',candidateEvidence:hits.flatMap(x=>x.evidence).slice(0,8),reason:'All explicitly required skills have supporting candidate evidence.',confidence:Math.min(...hits.map(x=>x.confidence||0.7))};
    if(hits.length)return {...base,status:'WARN',candidateEvidence:hits.flatMap(x=>x.evidence).slice(0,8),reason:'Only part of the explicitly required skill set has candidate evidence.',confidence:0.65};
    return {...base,status:'FAIL',candidateEvidence:availableSkills.map(x=>x.original).slice(0,8),reason:'Available candidate skill evidence does not include the explicitly required skill(s).',confidence:0.7};
  }
  if(/experience/.test(key)){
    const req=firstNumber(requirement),got=num(profile?.professional?.relevantExperienceYears?.normalized??profile?.professional?.totalExperienceYears?.normalized);
    if(req==null||got==null)return base;
    return got>=req?{...base,status:'PASS',candidateEvidence:[String(got)+' years experience'],reason:'Candidate meets the explicit minimum of '+req+' years.',confidence:0.85}:{...base,status:'FAIL',candidateEvidence:[String(got)+' years experience'],reason:'Candidate is below the explicit minimum of '+req+' years.',confidence:0.85};
  }
  if(/certification|license/.test(key)){
    const certs=profile?.certifications||[],hits=certs.filter(x=>contains(x.normalized,requirement)||contains(requirement,x.normalized));
    if(hits.length)return {...base,status:'PASS',candidateEvidence:hits.map(x=>x.original).slice(0,8),reason:'Required certification/license is supported by candidate evidence.',confidence:0.85};
    return certs.length?{...base,status:'FAIL',candidateEvidence:certs.map(x=>x.original).slice(0,8),reason:'Supplied certifications do not include the explicit requirement.',confidence:0.8}:base;
  }
  if(/authorization|visa|sponsor/.test(key)){
    const auth=profile?.workContext?.workAuthorization||[];if(!auth.length)return base;
    const corpus=auth.map(x=>x.normalized).join(' | ');
    return contains(corpus,requirement)||contains(requirement,corpus)?{...base,status:'PASS',candidateEvidence:auth.map(x=>x.original),reason:'Candidate-supplied authorization data supports the requirement.',confidence:0.8}:{...base,status:'WARN',candidateEvidence:auth.map(x=>x.original),reason:'Authorization data exists but does not prove the exact requirement; human verification is required.',confidence:0.55};
  }
  if(/location|city|country|work.?model|remote|hybrid|onsite/.test(key)){
    const vals=[profile?.identity?.location?.normalized,profile?.workContext?.workplacePreference?.normalized,...((profile?.workContext?.preferredLocations||[]).map(x=>x.normalized))].filter(Boolean);
    if(!vals.length)return base;const corpus=vals.join(' | ');
    return contains(corpus,requirement)||contains(requirement,corpus)?{...base,status:'PASS',candidateEvidence:vals,reason:'Explicit location/work-model data is compatible.',confidence:0.75}:{...base,status:'WARN',candidateEvidence:vals,reason:'Location/work-model data does not clearly match; recruiter confirmation is required.',confidence:0.55};
  }
  if(/availability|notice|start/.test(key)){
    const days=num(profile?.availability?.noticePeriodDays?.normalized),status=profile?.availability?.status?.normalized||'';
    if(days==null&&(!status||status==='UNKNOWN'))return base;const req=firstNumber(requirement);
    if(req!=null&&days!=null)return days<=req?{...base,status:'PASS',candidateEvidence:[String(days)+' day notice'],reason:'Candidate notice period is within the explicit condition.',confidence:0.85}:{...base,status:'FAIL',candidateEvidence:[String(days)+' day notice'],reason:'Candidate notice period exceeds the explicit condition.',confidence:0.85};
    return {...base,status:'WARN',candidateEvidence:[status,days!=null?String(days)+' day notice':''].filter(Boolean),reason:'Availability exists but cannot be deterministically resolved.',confidence:0.6};
  }
  return {...base,reason:'Approved hard-rule field is unsupported by the deterministic evaluator; recruiter confirmation is required.',confidence:0.1};
}
export function evaluateHardRules(criteria=[],profile={}){
  return criteria.filter(c=>criterionKind(c)==='HARD_REQUIREMENT'&&(c?.am_confirmed??c?.amConfirmed)===true&&(c?.enforcement||'ACTIVE')==='ACTIVE').map(c=>evaluateHardRule(c,profile));
}

export function evaluateRequirementCriterion(criterion,profile={}){
  const kind=criterionKind(criterion),requirement=criterionValue(criterion),key=criterionField(criterion);
  const base={criterionId:criterion?.id||null,kind,label:txt(criterion?.label||requirement,500),field:key,requirement,status:'UNKNOWN',candidateEvidence:[],requirementEvidence:criterionEvidence(criterion),reason:'Available candidate evidence is insufficient to resolve this requirement.',confidence:0.2};
  if(!requirement)return base;
  if(/skill|technology|tool/.test(key)){
    const available=profile?.skills||[];if(!available.length)return base;
    const hit=skillHit(profile,requirement);
    if(hit)return {...base,status:'PASS',candidateEvidence:hit.evidence,reason:'Candidate evidence supports this approved skill requirement.',confidence:hit.confidence||0.75};
    return {...base,status:kind==='NICE_TO_HAVE'?'WARN':'FAIL',candidateEvidence:available.map(x=>x.original).slice(0,10),reason:kind==='NICE_TO_HAVE'?'Preferred skill is not evidenced in the available profile.':'Approved must-have skill is not evidenced in the available profile.',confidence:0.65};
  }
  if(/experience/.test(key)){
    const req=firstNumber(requirement),got=num(profile?.professional?.relevantExperienceYears?.normalized??profile?.professional?.totalExperienceYears?.normalized);
    if(req==null||got==null)return base;
    return got>=req?{...base,status:'PASS',candidateEvidence:[String(got)+' years experience'],reason:'Candidate meets the approved experience baseline.',confidence:0.85}:{...base,status:'FAIL',candidateEvidence:[String(got)+' years experience'],reason:'Candidate is below the approved experience baseline.',confidence:0.85};
  }
  if(/certification|license/.test(key)){
    const certs=profile?.certifications||[];if(!certs.length)return base;
    const hits=certs.filter(x=>contains(x.normalized,requirement)||contains(requirement,x.normalized));
    return hits.length?{...base,status:'PASS',candidateEvidence:hits.map(x=>x.original),reason:'Candidate evidence supports the certification requirement.',confidence:0.85}:{...base,status:kind==='NICE_TO_HAVE'?'WARN':'FAIL',candidateEvidence:certs.map(x=>x.original).slice(0,10),reason:'Available certification evidence does not include this requirement.',confidence:0.7};
  }
  if(/authorization|visa|sponsor/.test(key)){
    const auth=profile?.workContext?.workAuthorization||[];if(!auth.length)return base;
    const corpus=auth.map(x=>x.normalized).join(' | ');
    return contains(corpus,requirement)||contains(requirement,corpus)?{...base,status:'PASS',candidateEvidence:auth.map(x=>x.original),reason:'Candidate-supplied authorization evidence supports this requirement.',confidence:0.8}:{...base,status:'WARN',candidateEvidence:auth.map(x=>x.original),reason:'Authorization is supplied but does not clearly resolve the requirement; human verification is needed.',confidence:0.55};
  }
  if(/location|city|country|work.?model|remote|hybrid|onsite/.test(key)){
    const vals=[profile?.identity?.location?.normalized,profile?.workContext?.workplacePreference?.normalized,...((profile?.workContext?.preferredLocations||[]).map(x=>x.normalized))].filter(Boolean);
    if(!vals.length)return base;const corpus=vals.join(' | ');
    return contains(corpus,requirement)||contains(requirement,corpus)?{...base,status:'PASS',candidateEvidence:vals,reason:'Explicit candidate location/work-model data supports this requirement.',confidence:0.75}:{...base,status:'WARN',candidateEvidence:vals,reason:'Location/work-model data is not a clear match; recruiter confirmation is required.',confidence:0.55};
  }
  if(/availability|notice|start/.test(key)){
    const result=evaluateHardRule(criterion,profile);
    return {...base,status:result.status,candidateEvidence:result.candidateEvidence,reason:result.reason,confidence:result.confidence};
  }
  const corpus=[profile?.professional?.currentTitle?.normalized,profile?.professional?.currentCompany?.normalized,...((profile?.professional?.previousTitles||[]).map(x=>x.normalized)),...((profile?.professional?.industries||[]).map(x=>x.normalized)),...((profile?.skills||[]).map(x=>x.normalized))].filter(Boolean).join(' | ');
  if(corpus&&contains(corpus,requirement))return {...base,status:'PASS',candidateEvidence:[requirement],reason:'Normalized candidate profile contains evidence relevant to this approved requirement.',confidence:0.6};
  return base;
}

export function evaluateRequirementResults(criteria=[],profile={}){
  return (Array.isArray(criteria)?criteria:[])
    .filter(c=>['MUST_HAVE','NICE_TO_HAVE','RANKING_PREFERENCE'].includes(criterionKind(c)))
    .map(c=>evaluateRequirementCriterion(c,profile));
}

function items(criteria,kind,re){return criteria.filter(c=>criterionKind(c)===kind&&(!re||re.test(criterionField(c))))}
function component(status,points,maxPoints,evidence,reason,confidence){return {status,points:Math.max(0,Math.min(maxPoints,Number(points)||0)),maxPoints,evidence:uniq(evidence,12),reason:txt(reason,1400),confidence:clamp(confidence)}}
function ratio(matches,total,weight,evidence){
  if(!total)return component('UNKNOWN',0,weight,evidence,'No approved criterion is available for this dimension.',0.2);
  const r=matches/total;return component(r>=.999?'PASS':r>0?'WARN':'FAIL',weight*r,weight,evidence,String(matches)+' of '+String(total)+' approved criteria have supporting evidence.',Math.min(.95,.55+.4*r));
}
function titleOverlap(a,b){
  const x=new Set(normalizeTitle(a).split(/\s+/).filter(t=>t.length>2)),y=new Set(normalizeTitle(b).split(/\s+/).filter(t=>t.length>2));
  if(!x.size||!y.size)return 0;let n=0;for(const t of x)if(y.has(t))n++;return n/Math.max(x.size,y.size);
}
export function matchBand(score,{hardFail=false,confidence=1}={}){
  if(hardFail)return 'Mandatory Requirement Missing';if(confidence<0.45)return 'Possible Match';if(score>=80)return 'Strong Match';if(score>=55)return 'Possible Match';return 'Low Match';
}

export function computeCandidateMatch({criteria=[],brief={},profile={},weights=BASELINE_WEIGHTS}={}){
  const w={...BASELINE_WEIGHTS,...weights},hardRules=evaluateHardRules(criteria,profile),hardFail=hardRules.some(x=>x.status==='FAIL'),hardUnknown=hardRules.some(x=>x.status==='UNKNOWN');
  const requirementResults=evaluateRequirementResults(criteria,profile);
  const must=items(criteria,'MUST_HAVE',/skill|technology|tool/),nice=items(criteria,'NICE_TO_HAVE',/skill|technology|tool/);
  const mustHits=must.map(c=>skillHit(profile,criterionValue(c))).filter(Boolean),niceHits=nice.map(c=>skillHit(profile,criterionValue(c))).filter(Boolean);
  const hasSkillEvidence=(profile?.skills||[]).length>0;
  const components={mandatorySkills:must.length&&!hasSkillEvidence?component('UNKNOWN',0,w.mandatorySkills,[],'Candidate skill evidence is unavailable; approved mandatory skills remain unresolved.',.15):ratio(mustHits.length,must.length,w.mandatorySkills,mustHits.flatMap(x=>x.evidence))};
  const ex=items(criteria,'MUST_HAVE',/experience/),reqExp=Math.max(0,...ex.map(c=>firstNumber(criterionValue(c))||0)),gotExp=num(profile?.professional?.relevantExperienceYears?.normalized??profile?.professional?.totalExperienceYears?.normalized);
  components.experienceFit=reqExp<=0?component('UNKNOWN',0,w.experienceFit,[],'No approved experience threshold is available.',.2):gotExp==null?component('UNKNOWN',0,w.experienceFit,[],'Candidate experience is not sufficiently evidenced.',.2):gotExp>=reqExp?component('PASS',w.experienceFit,w.experienceFit,[String(gotExp)+' years'],'Candidate meets or exceeds '+String(reqExp)+' years.',.85):component('FAIL',w.experienceFit*Math.max(0,gotExp/reqExp),w.experienceFit,[String(gotExp)+' years'],'Candidate is below the '+String(reqExp)+'-year baseline.',.85);
  const reqTitle=brief?.fields?.jobTitle?.value||brief?.jobTitle||'',candTitle=profile?.professional?.currentTitle?.normalized||'',tr=titleOverlap(reqTitle,candTitle);
  const domain=[...items(criteria,'MUST_HAVE',/domain|industry|title|role/),...items(criteria,'NICE_TO_HAVE',/domain|industry|title|role/)];
  const corpus=[candTitle,...((profile?.professional?.industries||[]).map(x=>x.normalized)),...((profile?.skills||[]).map(x=>x.normalized))].join(' | ');
  const dh=domain.filter(c=>contains(corpus,criterionValue(c))),dr=domain.length?dh.length/domain.length:0,td=Math.max(tr,dr);
  components.titleDomain=(reqTitle||domain.length)?component(td>=.65?'PASS':td>0?'WARN':'FAIL',w.titleDomain*td,w.titleDomain,[candTitle,...dh.map(criterionValue)].filter(Boolean),'Normalized title/domain relevance.',.7):component('UNKNOWN',0,w.titleDomain,[],'No approved title/domain baseline is available.',.2);
  const loc=[...items(criteria,'MUST_HAVE',/location|city|country|work.?model|remote|hybrid|onsite/),...items(criteria,'NICE_TO_HAVE',/location|city|country|work.?model|remote|hybrid|onsite/)];
  const lc=[profile?.identity?.location?.normalized,profile?.workContext?.workplacePreference?.normalized,...((profile?.workContext?.preferredLocations||[]).map(x=>x.normalized))].filter(Boolean).join(' | ');
  components.locationWorkModel=ratio(loc.filter(c=>contains(lc,criterionValue(c))||contains(criterionValue(c),lc)).length,loc.length,w.locationWorkModel,[lc]);
  const auth=[...items(criteria,'MUST_HAVE',/authorization|visa|sponsor/),...items(criteria,'HARD_REQUIREMENT',/authorization|visa|sponsor/).filter(c=>(c?.am_confirmed??c?.amConfirmed)===true)];
  const ac=(profile?.workContext?.workAuthorization||[]).map(x=>x.normalized).join(' | ');
  components.workAuthorization=ac?ratio(auth.filter(c=>contains(ac,criterionValue(c))||contains(criterionValue(c),ac)).length,auth.length,w.workAuthorization,[ac]):component('UNKNOWN',0,w.workAuthorization,[],'Work authorization is not explicitly supplied.',.15);
  const av=[...items(criteria,'MUST_HAVE',/availability|notice|start/),...items(criteria,'HARD_REQUIREMENT',/availability|notice|start/).filter(c=>(c?.am_confirmed??c?.amConfirmed)===true)];
  const avKnown=(profile?.availability?.status?.normalized&&profile.availability.status.normalized!=='UNKNOWN')||profile?.availability?.noticePeriodDays?.normalized!=='';
  if(!av.length)components.availability=component('UNKNOWN',0,w.availability,[],'No approved availability condition is available.',.2);
  else if(!avKnown)components.availability=component('UNKNOWN',0,w.availability,[],'Candidate availability is unknown.',.15);
  else{const rs=av.map(c=>evaluateHardRule(c,profile)),p=rs.filter(x=>x.status==='PASS').length,q=rs.filter(x=>x.status==='WARN').length;components.availability=component(p===rs.length?'PASS':p+q>0?'WARN':'FAIL',w.availability*((p+q*.5)/rs.length),w.availability,rs.flatMap(x=>x.candidateEvidence),rs.map(x=>x.reason).join(' '),.75)}
  components.preferredSkills=nice.length&&!hasSkillEvidence?component('UNKNOWN',0,w.preferredSkills,[],'Candidate skill evidence is unavailable; preferred skills remain unresolved.',.15):ratio(niceHits.length,nice.length,w.preferredSkills,niceHits.flatMap(x=>x.evidence));
  const issues=[...(profile?.signals?.timelineInconsistencies||[]),...(profile?.signals?.conflicts||[])],missing=profile?.signals?.missingCriticalInformation||[],penalty=Math.min(1,issues.length*.25+missing.length*.08);
  components.profileConsistency=component(issues.length?'WARN':'PASS',w.profileConsistency*(1-penalty),w.profileConsistency,issues,issues.length?'Profile contains consistency signals requiring human review.':'No material consistency conflict was detected.',issues.length?.6:.8);
  let evaluated=0,earned=0,conf=0;
  for(const c of Object.values(components)){if(c.status==='UNKNOWN')continue;evaluated+=c.maxPoints;earned+=c.points;conf+=c.confidence*c.maxPoints}
  const score=evaluated?Math.round(earned/evaluated*100):0,coverage=evaluated/100,confidence=evaluated?Math.round(conf/evaluated*coverage*100)/100:0;
  const strengths=[],gaps=[],uncertainties=[];
  for(const [name,c] of Object.entries(components)){const row={dimension:name,reason:c.reason,evidence:c.evidence};if(c.status==='PASS')strengths.push(row);else if(c.status==='UNKNOWN')uncertainties.push(row);else gaps.push(row)}
  for(const h of hardRules){const row={dimension:'hardRule',requirement:h.requirement,reason:h.reason,evidence:h.candidateEvidence,status:h.status};if(h.status==='PASS')strengths.push(row);else if(h.status==='FAIL')gaps.push(row);else uncertainties.push(row)}
  for(const x of missing)uncertainties.push({dimension:'missingData',reason:x,evidence:[]});
  for(const x of issues)uncertainties.push({dimension:'consistency',reason:x,evidence:[]});
  if(profile?.signals?.promptInjectionDetected)uncertainties.push({dimension:'inputSafety',reason:'Instruction-like resume text was treated only as untrusted candidate data.',evidence:profile.signals.promptInjectionSignals});
  return {score,band:matchBand(score,{hardFail,confidence}),confidence,coverage:Math.round(coverage*100)/100,hardRuleStatus:hardFail?'FAIL':hardUnknown?'UNKNOWN':hardRules.some(x=>x.status==='WARN')?'WARN':'PASS',hardRules,requirementResults,components,strengths:strengths.slice(0,20),gaps:gaps.slice(0,20),uncertainties:uncertainties.slice(0,30),evidenceMeta:{evaluatedWeight:evaluated,totalWeight:100,scoreIsDecision:false},recommendation:hardFail?'RECRUITER_REVIEW_REQUIRED':score>=80?'WORTH_SCREENING':score>=55?'REVIEW_AND_SCREEN_IF_RELEVANT':'RECRUITER_REVIEW_REQUIRED'};
}
export function candidateMatchIdempotencyKey(v={}){
  return createHash('sha256').update([v.agencyId||'',v.jobId||'',v.candidateId||'',v.briefId||'',v.profileHash||'',v.scoringVersion||SCORING_CONFIG_VERSION,v.promptVersion||CANDIDATE_PROMPT_VERSION,v.schemaVersion||CANDIDATE_MATCH_SCHEMA_VERSION].join('|')).digest('hex');
}
export function isMaterialCandidateChange(a,b){return candidateProfileHash(a)!==candidateProfileHash(b)}
