'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const FIELD_STATUS=['confirmed_from_jd','inferred_candidate','missing','ambiguous','conflicting'];
const LABELS={
  jobTitle:'Job title',roleFamily:'Role family',seniority:'Seniority',openings:'Openings',employmentType:'Employment type',
  clientContext:'Client context',workModel:'Work model',city:'City',state:'State / region',country:'Country (ISO code)',
  experience:'Experience range',relevantExperience:'Relevant experience',mandatorySkills:'Mandatory skills',
  preferredSkills:'Preferred skills',technologiesTools:'Technologies / tools',industryDomain:'Industry / domain',
  responsibilities:'Responsibilities',education:'Education',certifications:'Certifications',compensation:'Compensation / rate',
  noticeAvailability:'Notice / availability',shiftTimezone:'Shift / timezone',travelRequirements:'Travel',
  communicationLanguages:'Communication / languages',workAuthorization:'Work authorization',
  deadlineUrgency:'Deadline / urgency',otherRestrictions:'Other explicit restrictions'
};
const LIST_FIELDS=new Set(['mandatorySkills','preferredSkills','technologiesTools','industryDomain','responsibilities','education','certifications','communicationLanguages','workAuthorization','otherRestrictions']);

function clone(value){return JSON.parse(JSON.stringify(value||{}))}
function lines(value){return Array.isArray(value)?value.join('\n'):''}
function parseLines(value){return String(value||'').split(/\n|,/).map((x)=>x.trim()).filter(Boolean).filter((x,i,a)=>a.findIndex((y)=>y.toLowerCase()===x.toLowerCase())===i)}
function prettyStatus(value){return String(value||'').replaceAll('_',' ')}
function evidence(field){return Array.isArray(field?.evidence)?field.evidence:[]}

async function api(action,payload={}){
  const res=await fetch('/api/requirements/jd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...payload})});
  const data=await res.json().catch(()=>({error:'invalid_response'}));
  if(!res.ok){const error=new Error(data?.error||'request_failed');error.details=data?.details;throw error}
  return data;
}

export default function JdBrainWorkspace({jobId,initialContext,aiConfigured=false}){
  const router=useRouter();const fileRef=useRef(null);
  const[ctx,setCtx]=useState(initialContext||{});
  const[newJd,setNewJd]=useState('');
  const[mode,setMode]=useState('PASTED');
  const[state,setState]=useState('idle');
  const[message,setMessage]=useState('');
  const[reason,setReason]=useState('');
  const[structured,setStructured]=useState(clone(initialContext?.brief?.structured_data||{}));
  const[brief,setBrief]=useState(clone(initialContext?.brief?.hiring_brief||{}));
  const[blueprint,setBlueprint]=useState(clone(initialContext?.brief?.search_blueprint||{}));
  const[criteria,setCriteria]=useState(clone(initialContext?.criteria||[]));
  const[clarifications,setClarifications]=useState(clone(initialContext?.clarifications||[]));
  const source=ctx?.source||{};const run=ctx?.run||{};const briefMeta=ctx?.brief||{};const job=ctx?.job||{};
  const sourceText=source.extracted_text||source.original_text||'';
  const canApprove=briefMeta?.brief_status==='READY_FOR_APPROVAL';
  const reviewLocked=briefMeta?.brief_status==='APPROVED'||briefMeta?.brief_status==='SUPERSEDED';
  const unresolvedBlocking=clarifications.filter((x)=>x.blocking&&!x.resolved).length;
  const pendingHard=criteria.filter((x)=>x.kind==='HARD_REQUIREMENT'&&(x.enforcement==='PROPOSED_REVIEW'||x.requiresAmConfirmation)&&!x.amConfirmed).length;

  async function refresh(){
    const res=await fetch(`/api/requirements/jd?jobId=${encodeURIComponent(jobId)}`,{cache:'no-store'});
    const data=await res.json().catch(()=>null);
    if(data?.ok){
      setCtx(data);setStructured(clone(data?.brief?.structured_data||{}));setBrief(clone(data?.brief?.hiring_brief||{}));
      setBlueprint(clone(data?.brief?.search_blueprint||{}));setCriteria(clone(data?.criteria||[]));setClarifications(clone(data?.clarifications||[]));
    }
  }
  async function ingest(){
    setState('saving');setMessage('');
    try{await api('ingestText',{jobId,sourceType:mode,text:newJd});setNewJd('');await refresh();setState('saved');setMessage('JD source version saved. Source text remains immutable.')}
    catch(e){setState('error');setMessage(e.message)}
  }
  async function upload(file){
    if(!file)return;setState('saving');setMessage('');
    const form=new FormData();form.set('jobId',jobId);form.set('file',file);
    try{
      const res=await fetch('/api/requirements/jd/upload',{method:'POST',body:form});const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data?.error||'upload_failed');
      await refresh();setState('saved');setMessage(data.duplicate?'This JD file version already exists.':'JD document stored privately and text extracted.');
    }catch(e){setState('error');setMessage(e.message)}
    finally{if(fileRef.current)fileRef.current.value=''}
  }
  async function analyze(){
    if(!source?.id)return;setState('processing');setMessage('');
    try{await api('analyze',{sourceId:source.id});await refresh();setState('saved');setMessage('AI Hiring Brief generated for Account Manager review.')}
    catch(e){setState('error');setMessage(e.message)}
  }
  function setField(name,next){
    setStructured((current)=>({...current,[name]:{...(current?.[name]||{}),...next}}));
  }
  function updateBrief(name,value){setBrief((current)=>({...current,[name]:value}))}
  function updateCriterion(index,patch){setCriteria((items)=>items.map((x,i)=>i===index?{...x,...patch}:x))}
  function removeCriterion(index){setCriteria((items)=>items.filter((_,i)=>i!==index))}
  function updateClarification(index,patch){setClarifications((items)=>items.map((x,i)=>i===index?{...x,...patch}:x))}
  async function saveDraft(){
    if(!briefMeta?.id)throw new Error('brief_not_available');
    setState('saving');setMessage('');
    try{
      const data=await api('saveDraft',{
        briefId:briefMeta.id,structuredData:structured,hiringBrief:brief,searchBlueprint:blueprint,
        inputSafety:briefMeta.input_safety||{promptInjectionDetected:false,signals:[]},criteria,clarifications,reason
      });
      await refresh();setState('saved');setMessage(`Draft saved · ${prettyStatus(data.brief_status)}`);return data;
    }catch(e){setState('error');setMessage(e.details?.join?.(', ')||e.message);throw e}
  }
  async function approve(){
    try{
      await saveDraft();
      const latestRes=await fetch(`/api/requirements/jd?jobId=${encodeURIComponent(jobId)}`,{cache:'no-store'});
      const latest=await latestRes.json();
      if(latest?.brief?.brief_status!=='READY_FOR_APPROVAL')throw new Error('Resolve blocking clarifications and confirm proposed hard rules before approval.');
      setState('saving');
      await api('approve',{jobId,briefId:latest.brief.id,note:reason});
      await refresh();setState('saved');setMessage('Hiring Brief approved. This requirement is now recruiter-ready.');router.refresh();
    }catch(e){setState('error');setMessage(e.details?.join?.(', ')||e.message)}
  }
  async function requestRevision(){
    if(!reason.trim()){setMessage('Add a revision reason first.');return}
    setState('saving');
    try{await api('requestRevision',{briefId:briefMeta.id,reason});await refresh();setState('saved');setMessage('Brief returned for revision.')}
    catch(e){setState('error');setMessage(e.message)}
  }

  const keyFields=useMemo(()=>Object.keys(LABELS),[]);

  function FieldEditor({name}){
    const field=structured?.[name]||{value:'',confidence:0,evidence:[],status:'missing'};
    const value=field.value;
    let input;
    if(LIST_FIELDS.has(name)){
      input=<textarea rows="3" value={lines(value)} onChange={(e)=>setField(name,{value:parseLines(e.target.value)})}/>;
    }else if(name==='openings'){
      input=<input type="number" min="1" value={value??''} onChange={(e)=>setField(name,{value:e.target.value?Number(e.target.value):null})}/>;
    }else if(name==='experience'){
      input=<div className="jd-inline-fields"><input type="number" min="0" step="0.5" placeholder="Min years" value={value?.minYears??''} onChange={(e)=>setField(name,{value:{...(value||{}),minYears:e.target.value===''?null:Number(e.target.value)}})}/><input type="number" min="0" step="0.5" placeholder="Max years" value={value?.maxYears??''} onChange={(e)=>setField(name,{value:{...(value||{}),maxYears:e.target.value===''?null:Number(e.target.value)}})}/><input placeholder="Relevant experience detail" value={value?.relevantExperienceText||''} onChange={(e)=>setField(name,{value:{...(value||{}),relevantExperienceText:e.target.value}})}/></div>;
    }else if(name==='compensation'){
      input=<div className="jd-inline-fields"><input type="number" min="0" placeholder="Min" value={value?.min??''} onChange={(e)=>setField(name,{value:{...(value||{}),min:e.target.value===''?null:Number(e.target.value)}})}/><input type="number" min="0" placeholder="Max" value={value?.max??''} onChange={(e)=>setField(name,{value:{...(value||{}),max:e.target.value===''?null:Number(e.target.value)}})}/><input placeholder="Currency" value={value?.currency||''} onChange={(e)=>setField(name,{value:{...(value||{}),currency:e.target.value.toUpperCase()}})}/><input placeholder="Period / rate" value={value?.period||''} onChange={(e)=>setField(name,{value:{...(value||{}),period:e.target.value}})}/></div>;
    }else{
      input=<input value={typeof value==='string'?value:''} onChange={(e)=>setField(name,{value:e.target.value})}/>;
    }
    return <article className="jd-field-card">
      <div className="jd-field-head"><b>{LABELS[name]}</b><span>{Math.round(Number(field.confidence||0)*100)}% confidence</span></div>
      {input}
      <div className="jd-field-meta"><select value={field.status||'missing'} onChange={(e)=>setField(name,{status:e.target.value})}>{FIELD_STATUS.map((v)=><option key={v} value={v}>{prettyStatus(v)}</option>)}</select>{evidence(field).length?<details><summary>Why did AI extract this?</summary>{evidence(field).map((x,i)=><p key={i}>“{x}”</p>)}</details>:<small>No JD evidence stored.</small>}</div>
    </article>;
  }

  return <div className="jd-brain">
    <section className="jd-status-strip">
      <div><span>Requirement</span><b>{prettyStatus(job.requirement_state||'JD_RECEIVED')}</b></div>
      <div><span>JD source</span><b>{source?.id?`v${source.version_number} · ${prettyStatus(source.source_status)}`:'Not ingested'}</b></div>
      <div><span>AI run</span><b>{run?.run_status?prettyStatus(run.run_status):'Not started'}</b></div>
      <div><span>AM review</span><b>{briefMeta?.brief_status?prettyStatus(briefMeta.brief_status):'Waiting for AI'}</b></div>
      <div className={job.recruiter_ready?'ready':'blocked'}><span>Recruiter ready</span><b>{job.recruiter_ready?'YES':'NO'}</b></div>
    </section>

    {message?<div className={state==='error'?'save-error profile-error':'pipeline-feedback success'} role="status" aria-live="polite">{message}</div>:null}
    {!aiConfigured?<div className="jd-warning"><b>AI provider not configured.</b><span>JD ingestion/review UI works, but analysis requires server-side OPENAI_API_KEY / model configuration.</span></div>:null}

    <section className="jd-ingest-panel">
      <div className="closeout-title"><div><h2>1. Source JD</h2><small>Original source is versioned and never overwritten. New text/file creates a new source version.</small></div>{source?.source_type==='UPLOAD'&&source?.id?<a className="ghost-action" href={`/api/requirements/jd/document?sourceId=${source.id}`} target="_blank">Open original document ↗</a>:null}</div>
      <div className="jd-source-grid">
        <div><label className="form-control"><span>Paste / existing requirement text</span><textarea rows="11" value={newJd} onChange={(e)=>setNewJd(e.target.value)} placeholder="Paste the raw client JD here…"/></label><div className="jd-ingest-actions"><select value={mode} onChange={(e)=>setMode(e.target.value)}><option value="PASTED">Pasted JD</option><option value="EXISTING">Existing requirement text</option></select><button onClick={ingest} disabled={state==='saving'||newJd.trim().length<20}>Save source version</button><label className="ghost-action jd-file-button">Upload PDF/DOCX/TXT<input ref={fileRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(e)=>upload(e.target.files?.[0])}/></label></div></div>
        <div className="jd-source-preview"><span>Current extracted text</span><pre>{sourceText||'No JD source has been ingested yet.'}</pre>{source?.id?<button className="primary-action" onClick={analyze} disabled={state==='processing'||source.source_status!=='READY'||!aiConfigured}>{state==='processing'?'Analyzing…':run?.run_status==='SUCCEEDED'?'Re-run safely':'Analyze JD with AI'}</button>:null}</div>
      </div>
    </section>

    {briefMeta?.id?<><fieldset className="jd-review-fieldset" disabled={reviewLocked}>
      <section className="profile-section">
        <div className="closeout-title"><div><h2>2. Structured extraction</h2><small>Every important field keeps confidence, status and JD evidence. AI inference never silently becomes a client requirement.</small></div><span className="status-pill">Brief v{briefMeta.version_number}</span></div>
        <div className="jd-field-grid">{keyFields.map((name)=><FieldEditor key={name} name={name}/>)}</div>
      </section>

      <section className="profile-section">
        <h2>3. Recruiter-ready Hiring Brief</h2>
        <div className="form-grid two">
          <label className="form-control wide"><span>Role summary</span><textarea rows="4" value={brief.roleSummary||''} onChange={(e)=>updateBrief('roleSummary',e.target.value)}/></label>
          <label className="form-control wide"><span>What the client actually needs</span><textarea rows="4" value={brief.clientNeed||''} onChange={(e)=>updateBrief('clientNeed',e.target.value)}/></label>
          <label className="form-control wide"><span>Ideal candidate profile</span><textarea rows="4" value={brief.idealCandidateProfile||''} onChange={(e)=>updateBrief('idealCandidateProfile',e.target.value)}/></label>
          <label className="form-control"><span>Must-have criteria</span><textarea rows="6" value={lines(brief.mustHaveCriteria)} onChange={(e)=>updateBrief('mustHaveCriteria',parseLines(e.target.value))}/></label>
          <label className="form-control"><span>Nice-to-have criteria</span><textarea rows="6" value={lines(brief.niceToHaveCriteria)} onChange={(e)=>updateBrief('niceToHaveCriteria',parseLines(e.target.value))}/></label>
          <label className="form-control"><span>Recruiter screening focus</span><textarea rows="6" value={lines(brief.recruiterScreeningFocus)} onChange={(e)=>updateBrief('recruiterScreeningFocus',parseLines(e.target.value))}/></label>
          <label className="form-control"><span>Candidate attributes NOT to assume</span><textarea rows="6" value={lines(brief.doNotAssume)} onChange={(e)=>updateBrief('doNotAssume',parseLines(e.target.value))}/></label>
        </div>
      </section>

      <section className="profile-section">
        <div className="closeout-title"><div><h2>4. Hard rules vs preferences</h2><small>Proposed hard rules cannot become active recruiter rejection rules until the AM confirms them.</small></div><span className={pendingHard?'status warn':'status good'}>{pendingHard} hard rule{pendingHard===1?'':'s'} need confirmation</span></div>
        <div className="jd-criteria-list">{criteria.length?criteria.map((c,i)=><article key={c.id||i} className={c.kind==='HARD_REQUIREMENT'?'hard':''}>
          <div className="jd-criterion-main"><select value={c.kind||'RANKING_PREFERENCE'} onChange={(e)=>updateCriterion(i,{kind:e.target.value})}><option>HARD_REQUIREMENT</option><option>MUST_HAVE</option><option>NICE_TO_HAVE</option><option>RANKING_PREFERENCE</option></select><input value={c.label||''} onChange={(e)=>updateCriterion(i,{label:e.target.value})}/><textarea rows="2" value={c.value||''} onChange={(e)=>updateCriterion(i,{value:e.target.value})}/></div>
          <div className="jd-criterion-meta"><span>{prettyStatus(c.status)} · {Math.round(Number(c.confidence||0)*100)}%</span><span>{prettyStatus(c.enforcement)}</span>{c.kind==='HARD_REQUIREMENT'&&(c.requiresAmConfirmation||c.enforcement==='PROPOSED_REVIEW')?<label><input type="checkbox" checked={Boolean(c.amConfirmed)} onChange={(e)=>updateCriterion(i,{amConfirmed:e.target.checked})}/> AM confirms this hard requirement</label>:null}<button className="danger-action" type="button" onClick={()=>removeCriterion(i)}>Remove</button></div>
          {Array.isArray(c.evidence)&&c.evidence.length?<details><summary>Evidence</summary>{c.evidence.map((x,n)=><p key={n}>“{x}”</p>)}</details>:null}
        </article>):<div className="ats-empty">No criteria extracted.</div>}</div>
      </section>

      <section className="profile-section">
        <div className="closeout-title"><div><h2>5. Missing / ambiguous / conflicting</h2><small>Blocking questions must be resolved before approval.</small></div><span className={unresolvedBlocking?'status warn':'status good'}>{unresolvedBlocking} blocking</span></div>
        <div className="jd-clarification-list">{clarifications.length?clarifications.map((q,i)=><article key={q.id||i}><div><b>{q.type} · {q.field}</b><p>{q.question}</p>{Array.isArray(q.evidence)&&q.evidence.length?<small>{q.evidence.join(' · ')}</small>:null}</div><label><input type="checkbox" checked={Boolean(q.resolved)} onChange={(e)=>updateClarification(i,{resolved:e.target.checked})}/> Resolved by AM</label><textarea rows="2" placeholder="Client/AM clarification…" value={q.resolution||''} onChange={(e)=>updateClarification(i,{resolution:e.target.value})}/></article>):<div className="ats-empty">No clarification issues detected.</div>}</div>
      </section>

      <section className="profile-section">
        <h2>6. Recruiter search blueprint</h2>
        <p className="jd-helper">Suggestions marked AI sourcing suggestion are guidance, not client requirements.</p>
        <div className="jd-blueprint-grid">
          {['primaryCandidateTitles','alternateTitles','mustHaveKeywords','skillSynonyms','domainKeywords','exclusionTerms','searchCombinations','talentPoolCategories'].map((key)=><div key={key}><b>{prettyStatus(key)}</b>{(blueprint?.[key]||[]).map((x,i)=><span key={i} title={(x.basisEvidence||[]).join(' · ')}>{x.value}<small>{x.provenance==='AI_SOURCING_SUGGESTION'?'AI suggestion':'JD evidence'}</small></span>)}</div>)}
        </div>
        <label className="form-control"><span>Boolean-search draft</span><textarea rows="4" value={blueprint.booleanSearchDraft||''} onChange={(e)=>setBlueprint((b)=>({...b,booleanSearchDraft:e.target.value}))}/></label>
      </section>

      <section className="jd-approval-panel">
        <div><span className="page-kicker">Account Manager gate</span><h2>Review → Save → Approve</h2><p>Approval is human-controlled. Until approved, this AI requirement is not recruiter-ready.</p></div>
        <label className="form-control"><span>Reason / approval context</span><textarea rows="3" value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Optional for edits/approval; required when sending back for revision."/></label>
        <div className="jd-approval-actions"><button onClick={saveDraft} disabled={state==='saving'}>Save draft</button><button className="ghost-action" onClick={requestRevision} disabled={!briefMeta.id||state==='saving'}>Send back for revision</button><button className="primary-action" onClick={approve} disabled={state==='saving'||briefMeta.brief_status==='APPROVED'}>{canApprove?'Approve Hiring Brief':'Resolve review items & approve'}</button></div>
      </section>
      </fieldset>{reviewLocked?<div className="jd-approved-lock"><b>Approved brief is read-only.</b><span>Ingest a new JD source version to start a new review cycle.</span></div>:null}
    </>:null}
  </div>;
}
