'use client';
import { useEffect,useState } from 'react';
const BUCKETS=[['WAITING_FOR_REVIEW','Waiting for Review'],['RETURNED_AWAITING_RECRUITER','Returned / Awaiting Recruiter'],['READY_APPROVED','Ready / Approved'],['RECENTLY_CLIENT_SUBMITTED','Recently Client Submitted'],['CLIENT_FEEDBACK_PENDING','Client Feedback Pending']];
function pretty(v){return String(v||'').replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase())}
function age(seconds){const n=Number(seconds||0);if(n<3600)return Math.max(1,Math.round(n/60))+'m';if(n<86400)return Math.round(n/3600)+'h';return Math.round(n/86400)+'d'}
export default function AccountManagerSubmissionQueue({initial}){
  const[bucket,setBucket]=useState(initial?.bucket||'WAITING_FOR_REVIEW');
  const[data,setData]=useState(initial||{rows:[]});
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');

  useEffect(()=>{
    if(bucket===initial?.bucket)return;
    let live=true;
    setLoading(true);
    setError('');
    fetch('/api/submissions?mode=queue&bucket='+encodeURIComponent(bucket),{cache:'no-store'})
      .then(async r=>{
        const d=await r.json().catch(()=>null);
        if(!r.ok||!d?.ok)throw new Error(d?.error||'queue_unavailable');
        if(live)setData(d);
      })
      .catch(()=>{if(live)setError('Submission queue could not be loaded. Choose the queue again to retry.')})
      .finally(()=>{if(live)setLoading(false)});
    return()=>{live=false};
  },[bucket,initial?.bucket]);

  return <div className="s6-workspace">
    <section className="s6-hero" aria-labelledby="submission-queue-title"><div><span>Step 6 · Account Manager</span><h1 id="submission-queue-title">Submission Quality Queue</h1><p>Review client fit, commercial correctness, visible risk and presentation quality without repeating recruiter screening.</p></div><div className="s6-state" aria-label={`${data.total||0} submissions in current queue`}><b>{data.total||0}</b><small>in current queue</small></div></section>
    <nav className="s6-tabs" aria-label="Submission queue filters">{BUCKETS.map(([k,l])=><button key={k} type="button" className={bucket===k?'active':''} aria-pressed={bucket===k} onClick={()=>setBucket(k)}>{l}</button>)}</nav>
    {loading?<p className="s6-muted" role="status" aria-live="polite">Loading queue…</p>:error?<p className="s6-muted" role="alert">{error}</p>:<section className="s6-queue" aria-label="Submission queue results">{(data.rows||[]).map(row=><a key={row.id} href={'/account-manager/submissions/'+row.application_id} aria-label={`Review ${row.candidate_name||'candidate'} for ${row.requirement_title||'requirement'}`}><div><b>{row.candidate_name}</b><span>{row.requirement_title}</span></div><div><span>{row.recruiter_name||'Recruiter'}</span><small>{age(row.age_seconds)} old</small></div><div><b>{pretty(row.workflow_status)}</b>{row.hold_reason?<small>{row.hold_reason}</small>:null}{row.last_return_reason_code?<small>{pretty(row.last_return_reason_code)}</small>:null}</div></a>)}{!data.rows?.length?<article className="s6-empty" role="status">Nothing in this queue.</article>:null}</section>}
  </div>;
}
