import { detectPromptInjectionSignals } from '../lib/jd-contract.mjs';

const emptyString=(value='',status='missing',evidence=[])=>({value,confidence:value?0.9:0,evidence,status:value?status:'missing'});
const emptyList=(value=[],status='missing',evidence=[])=>({value,confidence:value.length?0.9:0,evidence,status:value.length?status:'missing'});

export function mockOutputForFixture(fixture){
  const e=fixture.expected||{};
  const must=e.mustSkills||[];const nice=e.niceSkills||[];
  const evidence=(value)=>value?[String(fixture.text).split(/\n/).find((line)=>line.toLowerCase().includes(String(value).toLowerCase()))||String(fixture.text).slice(0,220)]:[];
  const title=e.title||fixture.role||'';
  const hard=(e.hardConcepts||[]).map((value)=>({
    kind:'HARD_REQUIREMENT',label:value,field:'otherRestrictions',value,confidence:0.94,
    evidence:evidence(value),status:'confirmed_from_jd',enforcement:'ACTIVE',requiresAmConfirmation:false,
  }));
  const criteria=[
    ...hard,
    ...must.map((value)=>({kind:'MUST_HAVE',label:value,field:'mandatorySkills',value,confidence:0.95,evidence:evidence(value),status:'confirmed_from_jd',enforcement:'ACTIVE',requiresAmConfirmation:false})),
    ...nice.map((value)=>({kind:'NICE_TO_HAVE',label:value,field:'preferredSkills',value,confidence:0.85,evidence:evidence(value),status:'confirmed_from_jd',enforcement:'INACTIVE',requiresAmConfirmation:false})),
  ];
  const clarifications=[];
  if(e.ambiguity)clarifications.push({type:e.conflict?'CONFLICTING':'MISSING',field:e.conflict?'workModel':'unspecified',question:e.conflict?'Please confirm the conflicting client requirement.':'Please confirm missing/ambiguous requirement details.',evidence:e.conflict?[String(fixture.text).slice(0,260)]:[],blocking:Boolean(e.conflict)});
  const signals=detectPromptInjectionSignals(fixture.text);
  const item=(value,provenance='AI_SOURCING_SUGGESTION')=>({value,basisEvidence:evidence(value),provenance});
  return {
    fields:{
      jobTitle:emptyString(title,'confirmed_from_jd',evidence(title)),
      roleFamily:emptyString(fixture.role||title,'inferred_candidate',[]),
      seniority:emptyString(/senior|vp|lead/i.test(title)?(title.match(/senior|vp|lead/i)?.[0]||''):'','inferred_candidate',[]),
      openings:{value:1,confidence:0.3,evidence:[],status:'inferred_candidate'},
      employmentType:emptyString('','missing',[]),
      clientContext:emptyString('','missing',[]),
      workModel:emptyString(e.workModel||'',e.workModel?'confirmed_from_jd':'missing',evidence(e.workModel)),
      city:emptyString(e.city||'',e.city?'confirmed_from_jd':'missing',evidence(e.city)),
      state:emptyString('','missing',[]),
      country:emptyString('','missing',[]),
      experience:{value:{minYears:e.minYears??null,maxYears:e.maxYears??null,relevantExperienceText:''},confidence:e.minYears!=null?0.92:0,evidence:e.minYears!=null?[String(fixture.text).slice(0,260)]:[],status:e.minYears!=null?'confirmed_from_jd':'missing'},
      relevantExperience:emptyString('','missing',[]),
      mandatorySkills:emptyList(must,must.length?'confirmed_from_jd':'missing',must.flatMap(evidence).slice(0,12)),
      preferredSkills:emptyList(nice,nice.length?'confirmed_from_jd':'missing',nice.flatMap(evidence).slice(0,12)),
      technologiesTools:emptyList([...must,...nice],must.length||nice.length?'confirmed_from_jd':'missing',[...must,...nice].flatMap(evidence).slice(0,12)),
      industryDomain:emptyList([],'missing',[]),
      responsibilities:emptyList([],'missing',[]),
      education:emptyList([],'missing',[]),
      certifications:(()=>{
        const values=e.hardConcepts?.filter((x)=>/cert|cissp|developer i/i.test(x))||[];
        return emptyList(values,values.length?'confirmed_from_jd':'missing',values.flatMap(evidence).slice(0,12));
      })(),
      compensation:{value:{min:null,max:null,currency:'',period:'',rateText:''},confidence:0,evidence:[],status:'missing'},
      noticeAvailability:emptyString((e.hardConcepts||[]).find((x)=>/day|join|notice/i.test(x))||'','confirmed_from_jd',[]),
      shiftTimezone:emptyString((e.hardConcepts||[]).find((x)=>/shift|on-call/i.test(x))||'','confirmed_from_jd',[]),
      travelRequirements:emptyString('','missing',[]),
      communicationLanguages:emptyList([],'missing',[]),
      workAuthorization:emptyList((e.hardConcepts||[]).filter((x)=>/authori|visa|sponsor/i.test(x)),'confirmed_from_jd',[]),
      deadlineUrgency:emptyString('','missing',[]),
      otherRestrictions:emptyList(e.hardConcepts||[],(e.hardConcepts||[]).length?'confirmed_from_jd':'missing',(e.hardConcepts||[]).flatMap(evidence).slice(0,12)),
    },
    criteria,
    clarifications,
    hiringBrief:{
      roleSummary:`${title}. ${must.length?`Core requirements: ${must.join(', ')}.`:''}`.trim(),
      clientNeed:must.length?`Client needs proven capability in ${must.join(', ')}.`:'Client intent needs Account Manager confirmation.',
      idealCandidateProfile:`${title} profile aligned to explicit JD evidence.`,
      mustHaveCriteria:must,
      niceToHaveCriteria:nice,
      knockoutRules:e.hardConcepts||[],
      majorResponsibilities:[],
      experienceExpectations:e.minYears!=null?`${e.minYears}${e.maxYears!=null?`-${e.maxYears}`:'+'} years as stated in JD.`:'Not specified.',
      locationWorkModel:[e.city,e.workModel].filter(Boolean).join(' · ')||'Not specified.',
      compensationConstraints:'Not specified.',
      workAuthorizationConstraints:(e.hardConcepts||[]).filter((x)=>/authori|visa|sponsor/i.test(x)).join('; '),
      candidateRedFlags:[],
      missingInformation:e.ambiguity?['Some requirement details need clarification.']:[],
      ambiguousRequirements:e.conflict?['JD contains conflicting requirements.']:[],
      clientClarificationQuestions:clarifications.map((x)=>x.question),
      recruiterScreeningFocus:must,
      recommendedSourcingKeywords:[...must,...nice,title].filter(Boolean),
      alternateRelevantTitles:[],
      searchConceptsSynonyms:[],
      doNotAssume:[],
    },
    searchBlueprint:{
      primaryCandidateTitles:[item(title,'JD_EVIDENCE')],
      alternateTitles:[],
      mustHaveKeywords:must.map((x)=>item(x,'JD_EVIDENCE')),
      skillSynonyms:nice.map((x)=>item(x)),
      domainKeywords:[],
      exclusionTerms:[],
      searchCombinations:must.length?[item(`${title} AND ${must.join(' AND ')}`)]:[],
      booleanSearchDraft:must.length?`("${title}") AND (${must.map((x)=>`"${x}"`).join(' AND ')})`:'',
      talentPoolCategories:[item(fixture.role||title)],
    },
    inputSafety:{promptInjectionDetected:signals.length>0,signals},
  };
}
