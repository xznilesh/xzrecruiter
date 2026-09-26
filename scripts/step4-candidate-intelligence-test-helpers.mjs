import fs from 'node:fs';
import {
  buildCandidateProfileSnapshot,computeCandidateMatch,evaluateDuplicatePair,
  detectCandidatePromptInjectionSignals
} from '../lib/candidate-intelligence.mjs';

export function loadFixtures(){
  return JSON.parse(fs.readFileSync('tests/fixtures/candidate-intelligence-regression.json','utf8'));
}
function signal(value='',confidence=0,evidence=[]){return {value:value??'',confidence,evidence}}
function nsignal(value=null,confidence=0,evidence=[]){return {value:value??null,confidence,evidence}}

export function aiOutputForFixture(fixture){
  const c=fixture.candidate||{},resume=String(fixture.resumeText||'');
  const evidence=(value)=>{
    const v=String(value??'').trim();
    if(!v)return [];
    const sentence=resume.split(/\n|(?<=[.!?])\s+/).find(x=>x.toLowerCase().includes(v.toLowerCase()));
    return [sentence||v].slice(0,1);
  };
  const skills=(c.skills||[]).map(name=>({name:String(name),estimatedYears:null,confidence:.9,evidence:evidence(name)}));
  return {
    identity:{
      name:signal(c.full_name||'',c.full_name?.9:0,evidence(c.full_name)),
      email:signal(c.email||'',c.email?.95:0,evidence(c.email)),
      phone:signal(c.phone||'',c.phone?.9:0,evidence(c.phone)),
      city:signal(c.city||'',c.city?.85:0,evidence(c.city)),
      region:signal(c.region||'',c.region?.8:0,evidence(c.region)),
      countryCode:signal(c.country_code||'',c.country_code?.85:0,evidence(c.country_code)),
    },
    professional:{
      currentTitle:signal(c.current_title||'',c.current_title?.85:0,evidence(c.current_title)),
      currentCompany:signal(c.current_company||'',c.current_company?.8:0,evidence(c.current_company)),
      previousTitles:[],
      totalExperienceYears:nsignal(c.experience_years??null,c.experience_years!=null?.85:0,c.experience_years!=null?evidence(String(c.experience_years)):[]),
      relevantExperienceYears:nsignal(c.relevant_experience_years??null,c.relevant_experience_years!=null?.8:0,c.relevant_experience_years!=null?evidence(String(c.relevant_experience_years)):[]),
      employmentTimeline:[],
      industries:[],
    },
    skills,
    certifications:(c.certifications||[]).map(name=>({name:String(name),issuer:'',date:'',evidence:evidence(name)})),
    education:[],
    availability:{
      status:signal(c.availability_status||'',c.availability_status?.85:0,evidence(c.availability_status)),
      noticePeriodDays:nsignal(c.notice_period_days??null,c.notice_period_days!=null?.9:0,c.notice_period_days!=null?evidence(String(c.notice_period_days)):[]),
      availabilityDate:signal('',0,[]),
    },
    workContext:{
      workModel:signal(c.workplace_preference||'',c.workplace_preference?.85:0,evidence(c.workplace_preference)),
      preferredLocations:c.desired_locations||[],
      workAuthorization:c.work_authorization_summary||[],
    },
    signals:{
      timelineInconsistencies:fixture.aiSignals?.timelineInconsistencies||[],
      missingCriticalInformation:fixture.aiSignals?.missingCriticalInformation||[],
      conflicts:fixture.aiSignals?.conflicts||[],
    },
    inputSafety:{
      promptInjectionDetected:detectCandidatePromptInjectionSignals(resume).length>0,
      signals:detectCandidatePromptInjectionSignals(resume),
    },
  };
}

export function profileForFixture(fixture,{useAi=false}={}){
  return buildCandidateProfileSnapshot({
    candidate:fixture.candidate||{},
    parseRun:{
      id:'parse-'+fixture.id,document_id:'doc-'+fixture.id,document_version:1,parser_version:'fixture-parser-v1',
      status:'SUCCEEDED',document_created_at:'2026-09-25T00:00:00Z',extracted_data:{skills:[]},field_confidence:{},field_evidence:{},
      extracted_text:fixture.resumeText||''
    },
    aiExtraction:useAi?aiOutputForFixture(fixture):{signals:{
      timelineInconsistencies:fixture.aiSignals?.timelineInconsistencies||[],
      missingCriticalInformation:fixture.aiSignals?.missingCriticalInformation||[],
      conflicts:fixture.aiSignals?.conflicts||[],
    }},
    resumeText:fixture.resumeText||''
  });
}

export function matchForFixture(fixture,options={}){
  const profile=profileForFixture(fixture,options);
  const match=computeCandidateMatch({
    criteria:fixture.criteria||[],
    brief:{fields:{jobTitle:{value:fixture.jobTitle||''}},hiringBrief:{}},
    profile,
    weights:options.weights||{}
  });
  return {profile,match};
}

export function duplicateForFixture(fixture){
  if(!fixture.duplicate)return null;
  return evaluateDuplicatePair(fixture.candidate||{},fixture.duplicate||{});
}
