export const JD_SCHEMA_VERSION = 'xz-jd-v1';
export const JD_PROMPT_VERSION = 'xz-jd-brain-2026-09-25-v1';

export const JD_FIELD_STATUSES = Object.freeze([
  'confirmed_from_jd',
  'inferred_candidate',
  'missing',
  'ambiguous',
  'conflicting',
]);

export const REQUIREMENT_REVIEW_STATES = Object.freeze([
  'PROCESSING',
  'NEEDS_REVIEW',
  'NEEDS_CLARIFICATION',
  'READY_FOR_APPROVAL',
  'APPROVED',
  'FAILED',
  'REVISION_REQUESTED',
  'SUPERSEDED',
]);

export const CRITERION_KINDS = Object.freeze(['HARD_REQUIREMENT','MUST_HAVE','NICE_TO_HAVE','RANKING_PREFERENCE']);
export const CRITERION_ENFORCEMENT = Object.freeze(['ACTIVE','PROPOSED_REVIEW','INACTIVE']);
export const CLARIFICATION_TYPES = Object.freeze(['MISSING','AMBIGUOUS','CONFLICTING']);
export const SOURCING_PROVENANCE = Object.freeze(['JD_EVIDENCE','AI_SOURCING_SUGGESTION']);

const stringFieldSchema = {
  type:'object',
  additionalProperties:false,
  required:['value','confidence','evidence','status'],
  properties:{
    value:{type:'string'},
    confidence:{type:'number',minimum:0,maximum:1},
    evidence:{type:'array',items:{type:'string'},maxItems:12},
    status:{type:'string',enum:JD_FIELD_STATUSES},
  },
};

const stringArrayFieldSchema = {
  type:'object',
  additionalProperties:false,
  required:['value','confidence','evidence','status'],
  properties:{
    value:{type:'array',items:{type:'string'},maxItems:80},
    confidence:{type:'number',minimum:0,maximum:1},
    evidence:{type:'array',items:{type:'string'},maxItems:20},
    status:{type:'string',enum:JD_FIELD_STATUSES},
  },
};

const integerFieldSchema = {
  type:'object',
  additionalProperties:false,
  required:['value','confidence','evidence','status'],
  properties:{
    value:{type:['integer','null'],minimum:1,maximum:10000},
    confidence:{type:'number',minimum:0,maximum:1},
    evidence:{type:'array',items:{type:'string'},maxItems:12},
    status:{type:'string',enum:JD_FIELD_STATUSES},
  },
};

const experienceFieldSchema = {
  type:'object',
  additionalProperties:false,
  required:['value','confidence','evidence','status'],
  properties:{
    value:{
      type:'object',
      additionalProperties:false,
      required:['minYears','maxYears','relevantExperienceText'],
      properties:{
        minYears:{type:['number','null'],minimum:0,maximum:60},
        maxYears:{type:['number','null'],minimum:0,maximum:60},
        relevantExperienceText:{type:'string'},
      },
    },
    confidence:{type:'number',minimum:0,maximum:1},
    evidence:{type:'array',items:{type:'string'},maxItems:12},
    status:{type:'string',enum:JD_FIELD_STATUSES},
  },
};

const compensationFieldSchema = {
  type:'object',
  additionalProperties:false,
  required:['value','confidence','evidence','status'],
  properties:{
    value:{
      type:'object',
      additionalProperties:false,
      required:['min','max','currency','period','rateText'],
      properties:{
        min:{type:['number','null'],minimum:0},
        max:{type:['number','null'],minimum:0},
        currency:{type:'string'},
        period:{type:'string'},
        rateText:{type:'string'},
      },
    },
    confidence:{type:'number',minimum:0,maximum:1},
    evidence:{type:'array',items:{type:'string'},maxItems:12},
    status:{type:'string',enum:JD_FIELD_STATUSES},
  },
};

const criterionSchema = {
  type:'object',
  additionalProperties:false,
  required:['kind','label','field','value','confidence','evidence','status','enforcement','requiresAmConfirmation'],
  properties:{
    kind:{type:'string',enum:CRITERION_KINDS},
    label:{type:'string'},
    field:{type:'string'},
    value:{type:'string'},
    confidence:{type:'number',minimum:0,maximum:1},
    evidence:{type:'array',items:{type:'string'},maxItems:10},
    status:{type:'string',enum:JD_FIELD_STATUSES},
    enforcement:{type:'string',enum:CRITERION_ENFORCEMENT},
    requiresAmConfirmation:{type:'boolean'},
  },
};

const clarificationSchema = {
  type:'object',
  additionalProperties:false,
  required:['type','field','question','evidence','blocking'],
  properties:{
    type:{type:'string',enum:CLARIFICATION_TYPES},
    field:{type:'string'},
    question:{type:'string'},
    evidence:{type:'array',items:{type:'string'},maxItems:10},
    blocking:{type:'boolean'},
  },
};

const sourcingItemSchema = {
  type:'object',
  additionalProperties:false,
  required:['value','basisEvidence','provenance'],
  properties:{
    value:{type:'string'},
    basisEvidence:{type:'array',items:{type:'string'},maxItems:8},
    provenance:{type:'string',enum:SOURCING_PROVENANCE},
  },
};

export const JD_AI_JSON_SCHEMA = Object.freeze({
  type:'object',
  additionalProperties:false,
  required:['fields','criteria','clarifications','hiringBrief','searchBlueprint','inputSafety'],
  properties:{
    fields:{
      type:'object',
      additionalProperties:false,
      required:[
        'jobTitle','roleFamily','seniority','openings','employmentType','clientContext','workModel',
        'city','state','country','experience','relevantExperience','mandatorySkills','preferredSkills',
        'technologiesTools','industryDomain','responsibilities','education','certifications','compensation',
        'noticeAvailability','shiftTimezone','travelRequirements','communicationLanguages','workAuthorization',
        'deadlineUrgency','otherRestrictions',
      ],
      properties:{
        jobTitle:stringFieldSchema,
        roleFamily:stringFieldSchema,
        seniority:stringFieldSchema,
        openings:integerFieldSchema,
        employmentType:stringFieldSchema,
        clientContext:stringFieldSchema,
        workModel:stringFieldSchema,
        city:stringFieldSchema,
        state:stringFieldSchema,
        country:stringFieldSchema,
        experience:experienceFieldSchema,
        relevantExperience:stringFieldSchema,
        mandatorySkills:stringArrayFieldSchema,
        preferredSkills:stringArrayFieldSchema,
        technologiesTools:stringArrayFieldSchema,
        industryDomain:stringArrayFieldSchema,
        responsibilities:stringArrayFieldSchema,
        education:stringArrayFieldSchema,
        certifications:stringArrayFieldSchema,
        compensation:compensationFieldSchema,
        noticeAvailability:stringFieldSchema,
        shiftTimezone:stringFieldSchema,
        travelRequirements:stringFieldSchema,
        communicationLanguages:stringArrayFieldSchema,
        workAuthorization:stringArrayFieldSchema,
        deadlineUrgency:stringFieldSchema,
        otherRestrictions:stringArrayFieldSchema,
      },
    },
    criteria:{type:'array',items:criterionSchema,maxItems:120},
    clarifications:{type:'array',items:clarificationSchema,maxItems:60},
    hiringBrief:{
      type:'object',
      additionalProperties:false,
      required:[
        'roleSummary','clientNeed','idealCandidateProfile','mustHaveCriteria','niceToHaveCriteria',
        'knockoutRules','majorResponsibilities','experienceExpectations','locationWorkModel',
        'compensationConstraints','workAuthorizationConstraints','candidateRedFlags','missingInformation',
        'ambiguousRequirements','clientClarificationQuestions','recruiterScreeningFocus',
        'recommendedSourcingKeywords','alternateRelevantTitles','searchConceptsSynonyms',
        'doNotAssume',
      ],
      properties:{
        roleSummary:{type:'string'},
        clientNeed:{type:'string'},
        idealCandidateProfile:{type:'string'},
        mustHaveCriteria:{type:'array',items:{type:'string'},maxItems:40},
        niceToHaveCriteria:{type:'array',items:{type:'string'},maxItems:40},
        knockoutRules:{type:'array',items:{type:'string'},maxItems:30},
        majorResponsibilities:{type:'array',items:{type:'string'},maxItems:40},
        experienceExpectations:{type:'string'},
        locationWorkModel:{type:'string'},
        compensationConstraints:{type:'string'},
        workAuthorizationConstraints:{type:'string'},
        candidateRedFlags:{type:'array',items:{type:'string'},maxItems:30},
        missingInformation:{type:'array',items:{type:'string'},maxItems:30},
        ambiguousRequirements:{type:'array',items:{type:'string'},maxItems:30},
        clientClarificationQuestions:{type:'array',items:{type:'string'},maxItems:30},
        recruiterScreeningFocus:{type:'array',items:{type:'string'},maxItems:30},
        recommendedSourcingKeywords:{type:'array',items:{type:'string'},maxItems:50},
        alternateRelevantTitles:{type:'array',items:{type:'string'},maxItems:30},
        searchConceptsSynonyms:{type:'array',items:{type:'string'},maxItems:50},
        doNotAssume:{type:'array',items:{type:'string'},maxItems:40},
      },
    },
    searchBlueprint:{
      type:'object',
      additionalProperties:false,
      required:[
        'primaryCandidateTitles','alternateTitles','mustHaveKeywords','skillSynonyms','domainKeywords',
        'exclusionTerms','searchCombinations','booleanSearchDraft','talentPoolCategories',
      ],
      properties:{
        primaryCandidateTitles:{type:'array',items:sourcingItemSchema,maxItems:20},
        alternateTitles:{type:'array',items:sourcingItemSchema,maxItems:30},
        mustHaveKeywords:{type:'array',items:sourcingItemSchema,maxItems:40},
        skillSynonyms:{type:'array',items:sourcingItemSchema,maxItems:50},
        domainKeywords:{type:'array',items:sourcingItemSchema,maxItems:30},
        exclusionTerms:{type:'array',items:sourcingItemSchema,maxItems:30},
        searchCombinations:{type:'array',items:sourcingItemSchema,maxItems:30},
        booleanSearchDraft:{type:'string'},
        talentPoolCategories:{type:'array',items:sourcingItemSchema,maxItems:30},
      },
    },
    inputSafety:{
      type:'object',
      additionalProperties:false,
      required:['promptInjectionDetected','signals'],
      properties:{
        promptInjectionDetected:{type:'boolean'},
        signals:{type:'array',items:{type:'string'},maxItems:20},
      },
    },
  },
});

function isPlainObject(value){
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function clampConfidence(value){
  const n=Number(value);
  if(!Number.isFinite(n)) return 0;
  return Math.max(0,Math.min(1,n));
}
function uniqueStrings(items,max=100){
  const out=[];
  for(const item of Array.isArray(items)?items:[]){
    const value=String(item??'').trim();
    if(!value) continue;
    if(!out.some((x)=>x.toLowerCase()===value.toLowerCase())) out.push(value);
    if(out.length>=max) break;
  }
  return out;
}
function normalizeStatus(value){
  return JD_FIELD_STATUSES.includes(value)?value:'missing';
}
function normalizeEvidence(value){
  return uniqueStrings(value,20).map((x)=>x.slice(0,900));
}
function normalizeStringField(value={}){
  return {
    value:String(value?.value??'').trim().slice(0,5000),
    confidence:clampConfidence(value?.confidence),
    evidence:normalizeEvidence(value?.evidence),
    status:normalizeStatus(value?.status),
  };
}
function normalizeStringArrayField(value={}){
  return {
    value:uniqueStrings(value?.value,80).map((x)=>x.slice(0,500)),
    confidence:clampConfidence(value?.confidence),
    evidence:normalizeEvidence(value?.evidence),
    status:normalizeStatus(value?.status),
  };
}
function normalizeIntegerField(value={}){
  const n=value?.value==null?null:Number(value.value);
  return {
    value:Number.isInteger(n)&&n>0&&n<=10000?n:null,
    confidence:clampConfidence(value?.confidence),
    evidence:normalizeEvidence(value?.evidence),
    status:normalizeStatus(value?.status),
  };
}
function normalizeExperienceField(value={}){
  const min=value?.value?.minYears==null?null:Number(value.value.minYears);
  const max=value?.value?.maxYears==null?null:Number(value.value.maxYears);
  return {
    value:{
      minYears:Number.isFinite(min)&&min>=0&&min<=60?min:null,
      maxYears:Number.isFinite(max)&&max>=0&&max<=60?max:null,
      relevantExperienceText:String(value?.value?.relevantExperienceText??'').trim().slice(0,2500),
    },
    confidence:clampConfidence(value?.confidence),
    evidence:normalizeEvidence(value?.evidence),
    status:normalizeStatus(value?.status),
  };
}
function normalizeCompensationField(value={}){
  const min=value?.value?.min==null?null:Number(value.value.min);
  const max=value?.value?.max==null?null:Number(value.value.max);
  return {
    value:{
      min:Number.isFinite(min)&&min>=0?min:null,
      max:Number.isFinite(max)&&max>=0?max:null,
      currency:String(value?.value?.currency??'').trim().slice(0,20),
      period:String(value?.value?.period??'').trim().slice(0,50),
      rateText:String(value?.value?.rateText??'').trim().slice(0,1000),
    },
    confidence:clampConfidence(value?.confidence),
    evidence:normalizeEvidence(value?.evidence),
    status:normalizeStatus(value?.status),
  };
}

export function detectPromptInjectionSignals(text){
  const source=String(text||'');
  const patterns=[
    /ignore\s+(?:(?:all|any|the)\s+)?(?:(?:previous|prior)\s+)?(?:(?:system|developer)\s+)?instructions?/ig,
    /reveal (?:the )?(?:system|developer) prompt/ig,
    /print (?:your )?(?:secrets?|api keys?|credentials?)/ig,
    /act as (?:the )?system/ig,
    /do not follow (?:the )?(?:system|developer)/ig,
    /override (?:the )?(?:system|developer) instructions?/ig,
    /BEGIN SYSTEM PROMPT/ig,
  ];
  const hits=[];
  for(const pattern of patterns){
    for(const match of source.matchAll(pattern)){
      const value=String(match[0]||'').trim();
      if(value&&!hits.some((x)=>x.toLowerCase()===value.toLowerCase())) hits.push(value);
      if(hits.length>=20) return hits;
    }
  }
  return hits;
}

export function normalizeAiRequirementOutput(raw){
  const value=isPlainObject(raw)?raw:{};
  const fields=isPlainObject(value.fields)?value.fields:{};
  const criteria=(Array.isArray(value.criteria)?value.criteria:[]).slice(0,120).map((item)=>({
    kind:CRITERION_KINDS.includes(item?.kind)?item.kind:'RANKING_PREFERENCE',
    label:String(item?.label??'').trim().slice(0,500),
    field:String(item?.field??'').trim().slice(0,120),
    value:String(item?.value??'').trim().slice(0,1000),
    confidence:clampConfidence(item?.confidence),
    evidence:normalizeEvidence(item?.evidence),
    status:normalizeStatus(item?.status),
    enforcement:CRITERION_ENFORCEMENT.includes(item?.enforcement)?item.enforcement:'INACTIVE',
    requiresAmConfirmation:Boolean(item?.requiresAmConfirmation),
  })).filter((x)=>x.label&&x.value);

  const clarifications=(Array.isArray(value.clarifications)?value.clarifications:[]).slice(0,60).map((item)=>({
    type:CLARIFICATION_TYPES.includes(item?.type)?item.type:'MISSING',
    field:String(item?.field??'').trim().slice(0,120),
    question:String(item?.question??'').trim().slice(0,1000),
    evidence:normalizeEvidence(item?.evidence),
    blocking:Boolean(item?.blocking),
  })).filter((x)=>x.field&&x.question);

  const brief=isPlainObject(value.hiringBrief)?value.hiringBrief:{};
  const blueprint=isPlainObject(value.searchBlueprint)?value.searchBlueprint:{};
  const sourcing=(items,max)=> (Array.isArray(items)?items:[]).slice(0,max).map((item)=>({
    value:String(item?.value??'').trim().slice(0,600),
    basisEvidence:normalizeEvidence(item?.basisEvidence).slice(0,8),
    provenance:SOURCING_PROVENANCE.includes(item?.provenance)?item.provenance:'AI_SOURCING_SUGGESTION',
  })).filter((x)=>x.value);

  return {
    fields:{
      jobTitle:normalizeStringField(fields.jobTitle),
      roleFamily:normalizeStringField(fields.roleFamily),
      seniority:normalizeStringField(fields.seniority),
      openings:normalizeIntegerField(fields.openings),
      employmentType:normalizeStringField(fields.employmentType),
      clientContext:normalizeStringField(fields.clientContext),
      workModel:normalizeStringField(fields.workModel),
      city:normalizeStringField(fields.city),
      state:normalizeStringField(fields.state),
      country:normalizeStringField(fields.country),
      experience:normalizeExperienceField(fields.experience),
      relevantExperience:normalizeStringField(fields.relevantExperience),
      mandatorySkills:normalizeStringArrayField(fields.mandatorySkills),
      preferredSkills:normalizeStringArrayField(fields.preferredSkills),
      technologiesTools:normalizeStringArrayField(fields.technologiesTools),
      industryDomain:normalizeStringArrayField(fields.industryDomain),
      responsibilities:normalizeStringArrayField(fields.responsibilities),
      education:normalizeStringArrayField(fields.education),
      certifications:normalizeStringArrayField(fields.certifications),
      compensation:normalizeCompensationField(fields.compensation),
      noticeAvailability:normalizeStringField(fields.noticeAvailability),
      shiftTimezone:normalizeStringField(fields.shiftTimezone),
      travelRequirements:normalizeStringField(fields.travelRequirements),
      communicationLanguages:normalizeStringArrayField(fields.communicationLanguages),
      workAuthorization:normalizeStringArrayField(fields.workAuthorization),
      deadlineUrgency:normalizeStringField(fields.deadlineUrgency),
      otherRestrictions:normalizeStringArrayField(fields.otherRestrictions),
    },
    criteria,
    clarifications,
    hiringBrief:{
      roleSummary:String(brief.roleSummary??'').trim().slice(0,4000),
      clientNeed:String(brief.clientNeed??'').trim().slice(0,4000),
      idealCandidateProfile:String(brief.idealCandidateProfile??'').trim().slice(0,4000),
      mustHaveCriteria:uniqueStrings(brief.mustHaveCriteria,40),
      niceToHaveCriteria:uniqueStrings(brief.niceToHaveCriteria,40),
      knockoutRules:uniqueStrings(brief.knockoutRules,30),
      majorResponsibilities:uniqueStrings(brief.majorResponsibilities,40),
      experienceExpectations:String(brief.experienceExpectations??'').trim().slice(0,2500),
      locationWorkModel:String(brief.locationWorkModel??'').trim().slice(0,2500),
      compensationConstraints:String(brief.compensationConstraints??'').trim().slice(0,2500),
      workAuthorizationConstraints:String(brief.workAuthorizationConstraints??'').trim().slice(0,2500),
      candidateRedFlags:uniqueStrings(brief.candidateRedFlags,30),
      missingInformation:uniqueStrings(brief.missingInformation,30),
      ambiguousRequirements:uniqueStrings(brief.ambiguousRequirements,30),
      clientClarificationQuestions:uniqueStrings(brief.clientClarificationQuestions,30),
      recruiterScreeningFocus:uniqueStrings(brief.recruiterScreeningFocus,30),
      recommendedSourcingKeywords:uniqueStrings(brief.recommendedSourcingKeywords,50),
      alternateRelevantTitles:uniqueStrings(brief.alternateRelevantTitles,30),
      searchConceptsSynonyms:uniqueStrings(brief.searchConceptsSynonyms,50),
      doNotAssume:uniqueStrings(brief.doNotAssume,40),
    },
    searchBlueprint:{
      primaryCandidateTitles:sourcing(blueprint.primaryCandidateTitles,20),
      alternateTitles:sourcing(blueprint.alternateTitles,30),
      mustHaveKeywords:sourcing(blueprint.mustHaveKeywords,40),
      skillSynonyms:sourcing(blueprint.skillSynonyms,50),
      domainKeywords:sourcing(blueprint.domainKeywords,30),
      exclusionTerms:sourcing(blueprint.exclusionTerms,30),
      searchCombinations:sourcing(blueprint.searchCombinations,30),
      booleanSearchDraft:String(blueprint.booleanSearchDraft??'').trim().slice(0,6000),
      talentPoolCategories:sourcing(blueprint.talentPoolCategories,30),
    },
    inputSafety:{
      promptInjectionDetected:Boolean(value?.inputSafety?.promptInjectionDetected),
      signals:uniqueStrings(value?.inputSafety?.signals,20),
    },
  };
}

function validateField(field,name,errors){
  if(!isPlainObject(field)) return errors.push(`${name}:field_required`);
  if(!JD_FIELD_STATUSES.includes(field.status)) errors.push(`${name}:invalid_status`);
  if(!Number.isFinite(Number(field.confidence))||Number(field.confidence)<0||Number(field.confidence)>1) errors.push(`${name}:invalid_confidence`);
  if(!Array.isArray(field.evidence)) errors.push(`${name}:evidence_array_required`);
  if(field.status==='confirmed_from_jd' && field.evidence.length===0) errors.push(`${name}:confirmed_requires_evidence`);
}

export function validateAiRequirementOutput(input,{forApproval=false}={}){
  const data=normalizeAiRequirementOutput(input);
  const errors=[];
  for(const [name,field] of Object.entries(data.fields)) validateField(field,name,errors);

  for(const [index,criterion] of data.criteria.entries()){
    if(!CRITERION_KINDS.includes(criterion.kind)) errors.push(`criteria[${index}]:invalid_kind`);
    if(criterion.enforcement==='ACTIVE'){
      if(criterion.kind==='HARD_REQUIREMENT' && criterion.status!=='confirmed_from_jd' && !criterion.requiresAmConfirmation){
        errors.push(`criteria[${index}]:hard_rule_not_confirmed`);
      }
      if(criterion.evidence.length===0) errors.push(`criteria[${index}]:active_requires_evidence`);
    }
    if(criterion.status!=='confirmed_from_jd' && criterion.kind==='HARD_REQUIREMENT' && criterion.enforcement==='ACTIVE'){
      errors.push(`criteria[${index}]:unconfirmed_hard_rule_active`);
    }
  }

  const exp=data.fields.experience.value;
  if(exp.minYears!=null&&exp.maxYears!=null&&exp.minYears>exp.maxYears) errors.push('experience:invalid_range');
  const comp=data.fields.compensation.value;
  if(comp.min!=null&&comp.max!=null&&comp.min>comp.max) errors.push('compensation:invalid_range');

  const blocking=data.clarifications.filter((x)=>x.blocking);
  if(forApproval&&blocking.length) errors.push('approval:blocking_clarifications');
  if(forApproval&&data.criteria.some((x)=>x.kind==='HARD_REQUIREMENT'&&x.enforcement==='PROPOSED_REVIEW')) errors.push('approval:hard_rules_need_confirmation');
  if(forApproval&&!data.hiringBrief.roleSummary) errors.push('approval:role_summary_required');
  if(forApproval&&!data.fields.jobTitle.value) errors.push('approval:job_title_required');

  return {ok:errors.length===0,errors,data};
}

export function deriveReviewState(input){
  const {data}=validateAiRequirementOutput(input);
  if(data.clarifications.some((x)=>x.blocking)) return 'NEEDS_CLARIFICATION';
  if(data.criteria.some((x)=>x.kind==='HARD_REQUIREMENT'&&x.enforcement==='PROPOSED_REVIEW')) return 'NEEDS_REVIEW';
  return 'READY_FOR_APPROVAL';
}

export function deriveCriteriaRows(input){
  const {data}=validateAiRequirementOutput(input);
  return data.criteria.map((x)=>({...x}));
}

export function deriveClarificationRows(input){
  const {data}=validateAiRequirementOutput(input);
  return data.clarifications.map((x)=>({...x,resolved:false,resolution:''}));
}

export function sanitizeJdText(text,maxChars=120000){
  return String(text||'')
    .replace(/\u0000/g,' ')
    .replace(/\r/g,'\n')
    .replace(/[\t\f\v]+/g,' ')
    .replace(/\n{4,}/g,'\n\n\n')
    .trim()
    .slice(0,maxChars);
}

export function isMaterialJdChange(previousText,nextText){
  const normalize=(value)=>sanitizeJdText(value)
    .toLowerCase()
    .replace(/\s+/g,' ')
    .replace(/[^a-z0-9+#./ -]/g,'')
    .trim();
  const a=normalize(previousText);
  const b=normalize(nextText);
  if(!a&&!b) return false;
  if(a===b) return false;
  const aTokens=new Set(a.split(' ').filter(Boolean));
  const bTokens=new Set(b.split(' ').filter(Boolean));
  const union=new Set([...aTokens,...bTokens]);
  let common=0;
  for(const token of aTokens) if(bTokens.has(token)) common++;
  const similarity=union.size?common/union.size:0;
  return similarity<0.97;
}

export function approvalReadiness(input){
  const result=validateAiRequirementOutput(input,{forApproval:true});
  return {
    ready:result.ok,
    errors:result.errors,
    state:result.ok?'READY_FOR_APPROVAL':deriveReviewState(result.data),
  };
}
