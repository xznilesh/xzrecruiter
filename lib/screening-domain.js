export const SCREENING_OUTCOMES = Object.freeze([
  'SCREENING_PENDING','IN_PROGRESS','FOLLOW_UP_REQUIRED','QUALIFIED','NOT_QUALIFIED',
  'CANDIDATE_NOT_INTERESTED','NO_RESPONSE','ON_HOLD','WITHDRAWN'
]);

export const FACT_SOURCES = Object.freeze([
  'RESUME_CLAIM','AI_INFERENCE','RECRUITER_VERIFIED','CANDIDATE_DECLARED','DOCUMENT_VERIFIED','UNKNOWN'
]);

export const QUESTION_CATEGORIES = Object.freeze([
  'MANDATORY_CONFIRMATION','ROLE_FIT','TECHNICAL_EXPERIENCE','LOGISTICS','AVAILABILITY',
  'COMPENSATION','AUTHORIZATION','CLARIFICATION','OPTIONAL'
]);

const PROHIBITED = [
  'race','caste','religion','sexual orientation','political view','political views','family status',
  'marital status','pregnant','pregnancy','appearance','ethnicity','disability','date of birth','age'
];

const HUMAN_FACT_SOURCES = new Set(['RECRUITER_VERIFIED','CANDIDATE_DECLARED','DOCUMENT_VERIFIED']);
const QUALIFY_ROLES = new Set(['OWNER','ADMIN','RECRUITER']);
const TERMINAL = new Set(['QUALIFIED','NOT_QUALIFIED','CANDIDATE_NOT_INTERESTED','WITHDRAWN']);

export function normalizeText(value='') {
  return String(value ?? '').replace(/\s+/g,' ').trim();
}

export function safeEvidenceText(value='') {
  const text=normalizeText(value);
  if(/ignore\s+(all|previous|prior)|system\s+prompt|developer\s+message|mark\s+(the\s+)?candidate\s+(as\s+)?qualified|override\s+(the\s+)?rules|bypass\s+(the\s+)?rules/i.test(text)) return '[untrusted instruction-like content withheld]';
  return text.slice(0,500);
}

export function isProtectedAttributeQuestion(text='') {
  const q=normalizeText(text).toLowerCase();
  return PROHIBITED.some((term)=>q.includes(term));
}

export function canRoleQualify(role) {
  return QUALIFY_ROLES.has(String(role||'').toUpperCase());
}

export function validateFactAssertion(fact={}) {
  const source=String(fact.source||'UNKNOWN').toUpperCase();
  if(!FACT_SOURCES.includes(source)) return {ok:false,error:'invalid_fact_source'};
  if(!normalizeText(fact.key)) return {ok:false,error:'fact_key_required'};
  if(source==='AI_INFERENCE' && fact.verified===true) return {ok:false,error:'ai_inference_cannot_be_verified'};
  if(source==='UNKNOWN' && fact.verified===true) return {ok:false,error:'unknown_cannot_be_verified'};
  if(fact.verified===true && !HUMAN_FACT_SOURCES.has(source)) return {ok:false,error:'verification_requires_human_or_document_source'};
  return {ok:true,source,verified:HUMAN_FACT_SOURCES.has(source) && fact.verified===true};
}

export function allowedOutcomeTransition(from='SCREENING_PENDING',to='IN_PROGRESS') {
  const a=String(from||'SCREENING_PENDING').toUpperCase();
  const b=String(to||'').toUpperCase();
  if(!SCREENING_OUTCOMES.includes(b)) return false;
  if(a===b) return true;
  const map={
    SCREENING_PENDING:new Set(['IN_PROGRESS','NO_RESPONSE','FOLLOW_UP_REQUIRED','ON_HOLD','WITHDRAWN']),
    IN_PROGRESS:new Set(['FOLLOW_UP_REQUIRED','QUALIFIED','NOT_QUALIFIED','CANDIDATE_NOT_INTERESTED','NO_RESPONSE','ON_HOLD','WITHDRAWN']),
    FOLLOW_UP_REQUIRED:new Set(['IN_PROGRESS','QUALIFIED','NOT_QUALIFIED','CANDIDATE_NOT_INTERESTED','NO_RESPONSE','ON_HOLD','WITHDRAWN']),
    ON_HOLD:new Set(['IN_PROGRESS','FOLLOW_UP_REQUIRED','QUALIFIED','NOT_QUALIFIED','CANDIDATE_NOT_INTERESTED','WITHDRAWN']),
    NO_RESPONSE:new Set(['IN_PROGRESS','FOLLOW_UP_REQUIRED','WITHDRAWN']),
    QUALIFIED:new Set(['IN_PROGRESS','ON_HOLD','WITHDRAWN']),
    NOT_QUALIFIED:new Set(['IN_PROGRESS','ON_HOLD']),
    CANDIDATE_NOT_INTERESTED:new Set(['IN_PROGRESS','WITHDRAWN']),
    WITHDRAWN:new Set([])
  };
  return Boolean(map[a]?.has(b));
}

function list(value){return Array.isArray(value)?value:[]}
function uniqByKey(items){const seen=new Set();return items.filter((x)=>{const k=x.key||x.question;if(!k||seen.has(k))return false;seen.add(k);return true})}

export function generateScreeningQuestions({requirement={},intelligence={},candidate={}}={}) {
  const out=[];
  const push=(q)=>{if(!q.question||isProtectedAttributeQuestion(q.question))return;out.push({priority:'MEDIUM',sourceEvidence:[],...q})};
  push({key:'candidate_interest',question:`Are you interested in the ${normalizeText(requirement.title)||'role'} and comfortable continuing in the process?`,reason:'Candidate interest must be explicitly confirmed by a human recruiter.',category:'MANDATORY_CONFIRMATION',priority:'CRITICAL',relatedRequirement:'candidate_interest'});
  push({key:'relevant_experience',question:'Please confirm your directly relevant experience for this role, including what you personally owned in production.',reason:'Confirms role-relevant experience instead of relying on resume or AI inference.',category:'TECHNICAL_EXPERIENCE',priority:'HIGH',relatedRequirement:'relevant_experience'});
  push({key:'availability',question:'What is your current notice period or earliest realistic start date?',reason:'Availability must come from the candidate or verified evidence.',category:'AVAILABILITY',priority:'HIGH',relatedRequirement:'availability'});
  push({key:'location_work_model',question:`Are you comfortable with the required work model${requirement.workplaceType?` (${requirement.workplaceType})`:''}${requirement.location?` and location (${requirement.location})`:''}?`,reason:'Confirms location and work-model compatibility.',category:'LOGISTICS',priority:'HIGH',relatedRequirement:'work_model'});
  if(requirement.compensationRequired || requirement.salaryMin!=null || requirement.salaryMax!=null) push({key:'compensation',question:'What compensation or rate expectation should we record for this opportunity?',reason:'Commercial screening is required for this requisition.',category:'COMPENSATION',priority:'HIGH',relatedRequirement:'compensation'});
  if(list(requirement.workAuthorizationRequirements).length) push({key:'work_authorization',question:'Please confirm the work-authorization status relevant to this role. Do not provide unrelated personal information.',reason:'The approved requirement contains an authorization constraint.',category:'AUTHORIZATION',priority:'CRITICAL',relatedRequirement:'work_authorization'});
  for(const [i,item] of list(requirement.mustHaves).entries()) {
    const label=normalizeText(typeof item==='string'?item:item?.label||item?.requirement||item?.text);
    if(label) push({key:`must_have_${i+1}`,question:`Please confirm your hands-on evidence for this must-have: ${label}`,reason:'Approved must-have requires human confirmation.',category:'MANDATORY_CONFIRMATION',priority:'CRITICAL',relatedRequirement:label,sourceEvidence:['APPROVED_REQUIREMENT']});
  }
  for(const [i,gap] of list(intelligence.gaps).entries()) {
    const label=safeEvidenceText(typeof gap==='string'?gap:gap?.label||gap?.text||gap?.reason);
    if(label) push({key:`gap_${i+1}`,question:`Please clarify this open point from the candidate analysis: ${label}`,reason:'Step-4 Candidate Intelligence marked this information as incomplete or uncertain.',category:'CLARIFICATION',priority:'HIGH',relatedRequirement:label,sourceEvidence:['STEP4_CANDIDATE_INTELLIGENCE']});
  }
  for(const [i,warning] of list(intelligence.warnings).entries()) {
    const label=safeEvidenceText(typeof warning==='string'?warning:warning?.label||warning?.text||warning?.reason);
    if(label) push({key:`warning_${i+1}`,question:`What evidence can confirm or resolve this warning: ${label}`,reason:'A Step-4 warning needs human evidence before safe progression.',category:'CLARIFICATION',priority:'HIGH',relatedRequirement:label,sourceEvidence:['STEP4_WARNING']});
  }
  for(const [i,q] of list(requirement.screeningQuestions).entries()) {
    const text=normalizeText(typeof q==='string'?q:q?.question);
    if(text) push({key:normalizeText(q?.id)||`approved_${i+1}`,question:text,reason:'Approved requisition screening question.',category:String(q?.category||'ROLE_FIT').toUpperCase(),priority:String(q?.priority||'MEDIUM').toUpperCase(),relatedRequirement:q?.relatedRequirement||null,sourceEvidence:['APPROVED_REQUIREMENT']});
  }
  return uniqByKey(out).slice(0,50);
}

export function buildScreeningBrief({candidate={},requirement={},intelligence={},facts=[]}={}) {
  const safeFacts=list(facts).filter((f)=>FACT_SOURCES.includes(String(f.source||'UNKNOWN').toUpperCase()));
  const unknowns=[];
  if(!candidate.availabilityStatus || candidate.availabilityStatus==='UNKNOWN') unknowns.push('availability');
  if(candidate.noticePeriodDays==null) unknowns.push('notice period');
  if(candidate.salaryExpected==null && requirement.compensationRequired) unknowns.push('compensation expectation');
  if(list(requirement.workAuthorizationRequirements).length && !safeFacts.some((f)=>f.key==='work_authorization'&&f.source!=='UNKNOWN')) unknowns.push('work authorization');
  const conflicts=safeFacts.reduce((acc,f)=>{const k=f.key;const v=JSON.stringify(f.value);(acc[k]??=new Set()).add(v);return acc},{});
  const conflictKeys=Object.entries(conflicts).filter(([,v])=>v.size>1).map(([k])=>k);
  return {
    candidateSnapshot:{name:candidate.fullName||null,currentTitle:candidate.currentTitle||null,currentCompany:candidate.currentCompany||null,location:candidate.location||candidate.city||null},
    role:{title:requirement.title||null,workplaceType:requirement.workplaceType||null,location:requirement.location||null},
    whyRelevant:list(intelligence.reasons).map(safeEvidenceText).slice(0,4),
    hardRuleStatus:String(intelligence.hardRuleStatus||'UNKNOWN').toUpperCase(),
    gaps:list(intelligence.gaps).map(safeEvidenceText).slice(0,6),
    unknowns:unknowns.slice(0,6),
    inconsistencies:[...list(intelligence.inconsistencies).map(safeEvidenceText).slice(0,6),...conflictKeys.map((k)=>`Conflicting sources for ${k}`)].slice(0,8),
    confirm:list(intelligence.confirm).map(safeEvidenceText).slice(0,6),
    attention:list(intelligence.warnings).map(safeEvidenceText).slice(0,6),
    blockers:list(intelligence.blockers).map(safeEvidenceText).slice(0,6),
    provenanceRule:'AI suggestions are not candidate answers. Only human/document evidence can create verified facts.'
  };
}

export function qualificationChecklist(input={}) {
  const checks=[];
  const add=(key,label,state,hard=false)=>checks.push({key,label,state,hard});
  add('must_haves','Must-have requirements reviewed',input.mustHavesReviewed?'PASS':'UNKNOWN',Boolean(input.mustHavesHard));
  add('interest','Candidate interest confirmed',input.interest==='INTERESTED'?'PASS':input.interest==='NOT_INTERESTED'?'FAIL':'UNKNOWN',true);
  add('experience','Relevant experience confirmed',input.relevantExperienceConfirmed?'PASS':'UNKNOWN',false);
  add('availability','Availability known',input.availabilityKnown?'PASS':'UNKNOWN',false);
  add('location','Location/work model acceptable',input.locationCompatible===true?'PASS':input.locationCompatible===false?'FAIL':'UNKNOWN',Boolean(input.locationHard));
  if(input.compensationRequired) add('compensation','Compensation/rate discussed',input.compensationKnown?'PASS':'UNKNOWN',Boolean(input.compensationHard));
  if(input.authorizationRequired) add('authorization','Authorization state sufficient',input.authorizationSufficient===true?'PASS':input.authorizationSufficient===false?'FAIL':'UNKNOWN',Boolean(input.authorizationHard));
  const hardRule=String(input.hardRuleStatus||'UNKNOWN').toUpperCase();
  add('step4_hard_rules','Step-4 hard-rule status',hardRule,['FAIL'].includes(hardRule)&&input.nonOverridable===true);
  const blockers=checks.filter((c)=>c.hard&&(c.state==='FAIL'||c.state==='UNKNOWN'));
  const warnings=checks.filter((c)=>!c.hard&&c.state!=='PASS');
  return {checks,blockers,warnings,canQualify:blockers.length===0 && input.interest==='INTERESTED'};
}

export function buildScreeningSummary({candidate={},requirement={},recruiter={},session={},facts=[],answers=[],checklist={}}={}) {
  const cleanFacts=list(facts).map((f)=>({key:f.key,value:f.value,source:String(f.source||'UNKNOWN').toUpperCase(),verified:Boolean(f.verified),recordedAt:f.recordedAt||null}));
  return {candidate:{id:candidate.id||null,name:candidate.fullName||candidate.name||null},requirement:{id:requirement.id||null,title:requirement.title||null},recruiter:{id:recruiter.id||null,name:recruiter.name||null},screeningDate:session.completedAt||session.updatedAt||null,outcome:session.outcome||session.status||'SCREENING_PENDING',candidateInterest:session.candidateInterest||'UNKNOWN',facts:cleanFacts,answers:list(answers).map((a)=>({key:a.key,answer:a.answer,source:a.source||'UNKNOWN'})),hardRuleIssues:list(session.hardRuleIssues),openQuestions:list(session.openQuestions),recruiterNotes:normalizeText(session.recruiterNotes||''),recruiterRecommendation:normalizeText(session.recommendation||''),nextAction:session.nextAction||null,checklist};
}

export function shouldTriggerMatchRecompute(previousFact,nextFact) {
  const watched=new Set(['relevant_experience','must_have','skills','location_work_model','availability','compensation','work_authorization']);
  if(!watched.has(String(nextFact?.key||''))) return false;
  return JSON.stringify(previousFact?.value) !== JSON.stringify(nextFact?.value);
}

export function duplicateScreeningPolicy({activeSession=false,previousCompleted=false,candidateChanged=false,requirementChanged=false}={}) {
  if(activeSession) return {action:'OPEN_EXISTING',allowed:false};
  if(previousCompleted && !candidateChanged && !requirementChanged) return {action:'SHOW_HISTORY_BEFORE_RESCREEN',allowed:true};
  return {action:'CREATE_NEW',allowed:true};
}

export function validateQuestion(question={}) {
  const text=normalizeText(question.question);
  if(!text) return {ok:false,error:'question_required'};
  if(isProtectedAttributeQuestion(text)) return {ok:false,error:'prohibited_screening_question'};
  const category=String(question.category||'ROLE_FIT').toUpperCase();
  if(!QUESTION_CATEGORIES.includes(category)) return {ok:false,error:'invalid_question_category'};
  return {ok:true,category};
}

export function terminalOutcome(outcome){return TERMINAL.has(String(outcome||'').toUpperCase())}
