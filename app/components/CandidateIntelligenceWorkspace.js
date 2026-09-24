'use client';

import { useMemo,useState } from 'react';
import { useRouter } from 'next/navigation';

function list(v){return Array.isArray(v)?v:[]}
function pct(v){const n=Number(v);return Number.isFinite(n)?Math.round(n*100):0}
function pretty(v){return String(v||'UNKNOWN').replaceAll('_',' ')}
function when(v){if(!v)return '—';try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch{return String(v)}}
function evidence(items){return list(items).filter(Boolean).slice(0,6)}

async function post(body){
  const res=await fetch('/api/candidate-intelligence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({error:'invalid_response'}));
  if(!res.ok){const e=new Error(data?.error||'request_failed');e.data=data;throw e}
  return data;
}

function Status({value}){
  const v=String(value||'UNKNOWN').toUpperCase();
  return <span className={'ci-status ci-'+v.toLowerCase()}>{pretty(v)}</span>;
}

function EvidenceList({items,empty='No supporting evidence captured.'}){
  const rows=evidence(items);
  return rows.length?<ul className="ci-evidence-list">{rows.map((x,i)=><li key={i}>{typeof x==='string'?x:JSON.stringify(x)}</li>)}</ul>:<p className="ci-muted">{empty}</p>;
}

function DuplicateEvidence({signals}){
  const labels={
    exactEmail:'Exact email',exactPhone:'Exact phone',exactResume:'Exact resume',
    exactSourceReference:'Exact source URL',nameEmployer:'Same name + employer',nameLocation:'Same name + location'
  };
  const rows=Object.entries(signals&&typeof signals==='object'?signals:{}).filter(([,value])=>Boolean(value));
  return rows.length?<div className="ci-duplicate-signals">{rows.map(([key])=><span key={key}>{labels[key]||pretty(key)}</span>)}</div>:<p className="ci-muted">No duplicate evidence signal captured.</p>;
}

function FindingList({title,items,empty}){
  const rows=list(items);
  return <section className="ci-card"><div className="ci-card-head"><h2>{title}</h2><span>{rows.length}</span></div>
    {rows.length?<div className="ci-findings">{rows.map((x,i)=><article key={i}><b>{pretty(x.dimension||x.status||'Finding')}</b><p>{x.reason||x.requirement||'Evidence-backed candidate finding'}</p><EvidenceList items={x.evidence}/></article>)}</div>:<p className="ci-muted">{empty}</p>}
  </section>;
}

export default function CandidateIntelligenceWorkspace({initialContext,jobId,candidateId,aiConfigured=false}){
  const router=useRouter();
  const[ctx,setCtx]=useState(initialContext||{});
  const[state,setState]=useState('idle');
  const[message,setMessage]=useState('');
  const[overrideReason,setOverrideReason]=useState('');

  const candidate=ctx.candidate||{};
  const job=ctx.job||{};
  const match=ctx.match||{};
  const analysisJob=ctx.analysis_job||{};
  const profile=ctx.profile||{};
  const source=ctx.source||{};
  const history=list(ctx.history);
  const duplicates=list(ctx.duplicates);
  const hardRules=list(match.hard_rule_results);
  const requirementResults=list(match.requirement_results);
  const mustResults=requirementResults.filter(x=>x.kind==='MUST_HAVE');
  const niceResults=requirementResults.filter(x=>x.kind==='NICE_TO_HAVE');
  const components=match.component_scores&&typeof match.component_scores==='object'?match.component_scores:{};
  const isCurrent=match.run_status==='SUCCEEDED';
  const needsOverride=match.recommendation!=='WORTH_SCREENING'||match.hard_rule_status!=='PASS';

  const topReasons=useMemo(()=>list(match.strengths).slice(0,3),[match.strengths]);

  async function refresh(){
    const res=await fetch('/api/candidate-intelligence?jobId='+encodeURIComponent(jobId)+'&candidateId='+encodeURIComponent(candidateId),{cache:'no-store'});
    const data=await res.json().catch(()=>null);
    if(data?.ok)setCtx(data);
  }

  async function analyze(){
    setState('analyzing');setMessage('');
    try{
      const data=await post({action:'analyze',jobId,candidateId});
      if(data?.context)setCtx(data.context);else await refresh();
      setState('saved');setMessage(data?.reused?'Current intelligence reused; inputs and versions are unchanged.':'Candidate intelligence generated from the current approved requirement and candidate evidence.');
    }catch(e){
      setState('error');
      setMessage(e.message==='already_processing'?'Analysis is already processing. Retry after refreshing.':e.message==='stale_input_during_analysis'?'Candidate/resume/requirement changed while analysis was running. Recompute from fresh inputs.':e.message);
    }
  }

  async function review(reviewAction){
    if(!match.id)return;
    setState('reviewing');setMessage('');
    try{
      const result=await post({action:'review',matchId:match.id,reviewAction,reason:overrideReason});
      await refresh();setState('saved');
      setMessage(result.handoff==='STEP_5_HUMAN_SCREENING'?'Marked ready for the next human-screening stage. Step 5 screening itself is not performed here.':'Recruiter review recorded.');
    }catch(e){
      setState('error');
      setMessage(e.message==='override_reason_required'?'Add a human reason before proceeding against an AI warning or hard-rule result.':e.message);
    }
  }

  return <div className="ci-workspace">
    {message?<div className={state==='error'?'save-error':'pipeline-feedback success'} role="status">{message}</div>:null}

    <section className="ci-header">
      <div>
        <span className="page-kicker">Step 4 · Candidate Intelligence</span>
        <h1>{candidate.full_name||'Candidate'}</h1>
        <p>{[candidate.current_title,candidate.current_company].filter(Boolean).join(' · ')||'Candidate profile'} → {job.title||'Approved requirement'}</p>
      </div>
      <div className="ci-header-actions">
        <a className="ghost-action" href={'/recruiter/requirements/'+jobId}>← Requirement</a>
        <button className="primary-action" onClick={analyze} disabled={state==='analyzing'||analysisJob.run_status==='PROCESSING'}>{state==='analyzing'||analysisJob.run_status==='PROCESSING'?'Analyzing…':isCurrent?'Recompute intelligence':'Generate intelligence'}</button>
      </div>
    </section>

    {!aiConfigured?<div className="ci-notice"><b>AI enrichment is not configured.</b><span>Deterministic matching still works from recruiter/profile/local parser evidence; unknown fields remain unknown rather than invented.</span></div>:null}
    {analysisJob.run_status==='PROCESSING'?<div className="ci-notice"><b>Candidate intelligence is processing.</b><span>Attempt {analysisJob.attempt_count||1}; refresh is safe and duplicate requests reuse the same job.</span></div>:null}
    {analysisJob.run_status==='FAILED'?<div className="ci-notice"><b>Last intelligence run failed.</b><span>{pretty(analysisJob.error_code||'PROCESSING_ERROR')} · retry count {analysisJob.retry_count||0}. No failed result is treated as current intelligence.</span></div>:null}
    {match.run_status==='STALE'?<div className="ci-notice"><b>Previous intelligence is stale.</b><span>Candidate, resume, approved requirement or scoring configuration changed. History is preserved; recompute before relying on it.</span></div>:null}

    <section className="ci-overview">
      <article className="ci-score">
        <span>Match overview</span>
        <b>{isCurrent?Math.round(Number(match.score||0))+'%':'—'}</b>
        <strong>{isCurrent?(match.match_band||'No band'):'Recompute required'}</strong>
        <small>Decision support only · not an approval or rejection</small>
      </article>
      <article><span>Confidence</span><b>{isCurrent?pct(match.confidence)+'%':'—'}</b><small>evidence + evaluated coverage</small></article>
      <article><span>Evidence coverage</span><b>{isCurrent?pct(match.coverage)+'%':'—'}</b><small>unknown dimensions reduce confidence</small></article>
      <article><span>Hard-rule status</span><b><Status value={isCurrent?match.hard_rule_status:'UNKNOWN'}/></b><small>only AM-confirmed rules can hard-fail</small></article>
      <article><span>Duplicate signal</span><b>{duplicates[0]?.duplicate_status?pretty(duplicates[0].duplicate_status):'No signal'}</b><small>{duplicates.length?'review evidence before any merge':'same-tenant check only'}</small></article>
    </section>

    {isCurrent&&match.hard_rule_status==='UNKNOWN'?<div className="ci-notice"><b>Confirmed hard rule still unresolved.</b><span>The score is not allowed to hide this uncertainty. Recruiter verification is required before relying on the fit band.</span></div>:null}

    {isCurrent?<section className="ci-card ci-reasons"><div className="ci-card-head"><div><span className="page-kicker">Fast read</span><h2>Why this candidate may be worth screening</h2></div><span>{match.recommendation?pretty(match.recommendation):'Human review required'}</span></div>
      {topReasons.length?<div className="ci-reason-grid">{topReasons.map((x,i)=><article key={i}><b>{pretty(x.dimension)}</b><p>{x.reason}</p><EvidenceList items={x.evidence}/></article>)}</div>:<p className="ci-muted">No strong evidence-backed reason has been established yet.</p>}
    </section>:null}

    <section className="ci-card">
      <div className="ci-card-head"><div><span className="page-kicker">Layer 1</span><h2>Approved hard-rule check</h2></div><span>{hardRules.length} confirmed rule{hardRules.length===1?'':'s'}</span></div>
      {hardRules.length?<div className="ci-rule-table">{hardRules.map((r,i)=><article key={i}>
        <div><Status value={r.status}/><b>{r.requirement}</b><p>{r.reason}</p></div>
        <div><span>Candidate evidence</span><EvidenceList items={r.candidateEvidence}/></div>
        <div><span>Requirement evidence</span><EvidenceList items={r.requirementEvidence}/></div>
        <small>Confidence {pct(r.confidence)}%</small>
      </article>)}</div>:<p className="ci-muted">No AM-confirmed active hard rules exist for this approved Hiring Brief.</p>}
    </section>

    <section className="ci-card">
      <div className="ci-card-head"><div><span className="page-kicker">Approved criteria</span><h2>Must-have check</h2></div><span>{mustResults.length}</span></div>
      {mustResults.length?<div className="ci-requirements">{mustResults.map((r,i)=><article key={i}><Status value={r.status}/><div><b>{r.label||r.requirement}</b><p>{r.reason}</p><EvidenceList items={r.candidateEvidence}/></div><small>{pct(r.confidence)}% confidence</small></article>)}</div>:<p className="ci-muted">No structured must-have criteria are available.</p>}
    </section>

    <div className="ci-three">
      <FindingList title="Strengths" items={match.strengths} empty="No strong evidence-backed strengths yet."/>
      <FindingList title="Gaps" items={match.gaps} empty="No evidence-backed gaps detected."/>
      <FindingList title="Risks / uncertainties" items={match.uncertainties} empty="No unresolved uncertainty captured."/>
    </div>

    <section className="ci-card">
      <div className="ci-card-head"><div><span className="page-kicker">Layer 2</span><h2>Fit dimensions</h2></div><span>Versioned scoring</span></div>
      <div className="ci-components">{Object.entries(components).map(([name,c])=><article key={name}><div><b>{pretty(name)}</b><Status value={c.status}/></div><strong>{Math.round(Number(c.points||0)*10)/10} / {c.maxPoints}</strong><p>{c.reason}</p><EvidenceList items={c.evidence}/></article>)}</div>
    </section>

    <div className="ci-two">
      <section className="ci-card"><div className="ci-card-head"><h2>Preferred skills</h2><span>{niceResults.length}</span></div>
        {niceResults.length?<div className="ci-requirements compact">{niceResults.map((r,i)=><article key={i}><Status value={r.status}/><div><b>{r.label||r.requirement}</b><p>{r.reason}</p></div></article>)}</div>:<p className="ci-muted">No approved preferred criteria.</p>}
      </section>
      <section className="ci-card"><div className="ci-card-head"><h2>Source & profile evidence</h2><span>{source.source_type||'Unknown source'}</span></div>
        <dl className="ci-facts">
          <div><dt>Source</dt><dd>{source.source_type||'Not supplied'}</dd></div>
          <div><dt>Sourced</dt><dd>{when(source.sourced_at)}</dd></div>
          <div><dt>Current title</dt><dd>{profile?.professional?.currentTitle?.original||candidate.current_title||'Unknown'}</dd></div>
          <div><dt>Total experience</dt><dd>{profile?.professional?.totalExperienceYears?.normalized!==''?String(profile?.professional?.totalExperienceYears?.normalized)+' years':'Unknown'}</dd></div>
          <div><dt>Availability</dt><dd>{pretty(profile?.availability?.status?.normalized||candidate.availability_status||'UNKNOWN')}</dd></div>
          <div><dt>Work model</dt><dd>{pretty(profile?.workContext?.workplacePreference?.normalized||candidate.workplace_preference||'UNKNOWN')}</dd></div>
          <div><dt>Resume version</dt><dd>{profile?.source?.documentVersion?('v'+profile.source.documentVersion):'No versioned resume'}</dd></div>
          <div><dt>Resume uploaded</dt><dd>{when(profile?.source?.documentCreatedAt)}</dd></div>
          <div><dt>Parse status</dt><dd>{pretty(profile?.source?.parseStatus||'UNKNOWN')}</dd></div>
          <div><dt>Parser version</dt><dd>{profile?.source?.parserVersion||'Not recorded'}</dd></div>
          <div><dt>Match model</dt><dd>{match.model_name||'Deterministic/local evidence'}</dd></div>
          <div><dt>Match generated</dt><dd>{when(match.generated_at)}</dd></div>
          {list(profile?.workContext?.workAuthorization).length?<div><dt>Authorization supplied</dt><dd>{list(profile.workContext.workAuthorization).map(x=>x.original||x.normalized).join(' · ')}</dd></div>:null}
        </dl>
        <h3>Normalized skills</h3>
        <div className="ci-chips">{list(profile.skills).slice(0,30).map((s,i)=><span key={i} title={'Original: '+String(s.original||s.normalized)+' · Source: '+String(s.source||'unknown')}>{s.normalized||s.original}<small>{s.source?pretty(s.source):''}</small></span>)}</div>
      </section>
    </div>

    <section className="ci-card">
      <div className="ci-card-head"><div><span className="page-kicker">Duplicate intelligence</span><h2>Potential duplicate evidence</h2></div><span>Never auto-merged</span></div>
      {duplicates.length?<div className="ci-duplicates">{duplicates.map((d)=><article key={d.id}><div><Status value={d.duplicate_status}/><b>{d.full_name}</b><span>{[d.current_title,d.current_company,d.city,d.country_code].filter(Boolean).join(' · ')}</span></div><strong>{d.score}/100 signal</strong><DuplicateEvidence signals={d.signals}/></article>)}</div>:<p className="ci-muted">No explainable same-tenant duplicate signal is currently stored.</p>}
    </section>

    <section className="ci-card">
      <div className="ci-card-head"><div><span className="page-kicker">Version history</span><h2>Previous intelligence</h2></div><span>{history.length}</span></div>
      <div className="ci-history">{history.length?history.map((h)=><article key={h.id}><div><b>{h.match_band||'No band'} · {h.score??'—'}%</b><span>{when(h.generated_at)}</span></div><Status value={h.run_status}/><small>Brief v{h.brief_version} · {h.scoring_version}{h.stale_reason?' · '+pretty(h.stale_reason):''}</small></article>):<p className="ci-muted">No previous match versions.</p>}</div>
    </section>

    {isCurrent?<section className="ci-card ci-human-review">
      <div className="ci-card-head"><div><span className="page-kicker">Human authority</span><h2>Recruiter review</h2><p>AI does not reject, submit, or screen the candidate. This only records your Step-4 review and handoff intent.</p></div><span>{pretty(match.intelligence_review_state||'NOT_REVIEWED')}</span></div>
      {needsOverride?<label className="form-control"><span>Reason if proceeding despite warning / blocker *</span><textarea rows="3" value={overrideReason} onChange={e=>setOverrideReason(e.target.value)} placeholder="Human reason for proceeding despite AI warning/uncertainty"/></label>:null}
      <div className="ci-review-actions">
        <button onClick={()=>review('ACKNOWLEDGE')} disabled={state==='reviewing'}>Acknowledge intelligence</button>
        <button onClick={()=>review('HOLD_FOR_CLARIFICATION')} disabled={state==='reviewing'}>Hold for clarification</button>
        <button className="primary-action" onClick={()=>review('PROCEED_TO_HUMAN_SCREENING')} disabled={state==='reviewing'||(needsOverride&&!overrideReason.trim())}>Mark ready for human screening →</button>
      </div>
      <small>Human screening questions/calls belong to Step 5 and are intentionally not implemented here.</small>
    </section>:null}
  </div>;
}
