'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

function progress(done,target){return target>0?Math.min(100,Math.round(done/target*100)):0}
function fmtDate(value){if(!value)return 'No deadline';try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(value))}catch{return value}}
function fmtWhen(value,timezone){if(!value)return 'No due time';try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:timezone||'UTC'}).format(new Date(value))}catch{return String(value)}}
async function post(body){
  const res=await fetch('/api/recruiter',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({error:'invalid_response'}));
  if(!res.ok)throw new Error(data?.error||'request_failed');
  return data;
}

export default function RecruiterCommandCenter({initialContext}){
  const router=useRouter();
  const[state,setState]=useState('idle');
  const ctx=initialContext||{};
  const today=ctx.today||{};
  const roles=ctx.requirements||[];
  const tasks=ctx.tasks||[];
  const interviews=ctx.interviews||[];

  async function completeTask(id){
    setState('saving');
    try{await post({action:'completeTask',taskId:id});setState('saved');router.refresh()}
    catch(e){setState(e.message||'error')}
  }

  if(!ctx.ok)return <section className="rx-empty"><h2>Recruiter workspace unavailable</h2><p>The execution contract is not available for this session yet.</p></section>;

  return <div className="rx-command">
    <section className="rx-today-grid" aria-label="Today recruiter metrics">
      <article><span>Daily submission target</span><b>{today.daily_target||0}</b><small>assigned across active roles</small></article>
      <article><span>Valid submissions</span><b>{today.valid_submissions_completed||0}</b><small>client-submitted today</small></article>
      <article className={Number(today.remaining_target||0)>0?'attention':'done'}><span>Remaining</span><b>{today.remaining_target||0}</b><small>draft/withdrawn do not count</small></article>
      <article><span>Due follow-ups</span><b>{today.due_followups||0}</b><small>overdue assigned tasks</small></article>
      <article><span>Screening actions</span><b>{today.screening_actions_due||0}</b><small>current persisted workflow</small></article>
      <article><span>Interview actions</span><b>{today.interview_actions||0}</b><small>scheduled today / next day</small></article>
    </section>

    <section className="rx-section">
      <div className="rx-section-head"><div><span className="page-kicker">My priority requirements</span><h2>Work in this order</h2><p>Deterministic order: target gap → manager/client priority → deadline → ageing → work readiness.</p></div><span className="status neutral">{ctx.business_date} · {ctx.timezone}</span></div>
      <div className="rx-role-grid">{roles.length?roles.map((r)=>{
        const done=Number(r.valid_submissions_today||0);
        const target=Number(r.daily_target||0);
        const remaining=Number(r.remaining_target||0);
        const percent=progress(done,target);
        const blockers=(r.blocker_reason?1:0)+(r.requirement_status==='ON_HOLD'?1:0);
        return <article className="rx-role-card" key={String(r.assignment_id)+'-'+String(r.job_id)}>
          <div className="rx-role-top"><div><span className={'rx-priority '+String(r.priority||'NORMAL').toLowerCase()}>{r.priority||'NORMAL'}</span><h3>{r.title}</h3><p>{r.client_name||'Account context unavailable'}</p></div><div className="rx-gap"><b>{remaining}</b><span>remaining</span></div></div>
          <p className="rx-brief">{r.brief_summary||'Approved Hiring Brief available in the requirement workspace.'}</p>
          <div className="rx-chips">{(Array.isArray(r.must_haves)?r.must_haves:[]).slice(0,4).map((x,i)=><span key={i}>{x}</span>)}</div>
          <div className="rx-progress-head"><span>{done}/{target} valid today</span><span>{percent}%</span></div>
          <div className="rx-progress"><i style={{width:String(percent)+'%'}}/></div>
          <div className="rx-role-stats"><div><span>Openings</span><b>{r.openings||1}</b></div><div><span>Pipeline</span><b>{r.pipeline_candidates||0}</b></div><div><span>Screening</span><b>{r.screening_pending||0}</b></div><div><span>Blockers</span><b>{blockers}</b></div></div>
          {r.manager_instructions?<div className="rx-manager-note"><b>Manager context</b><span>{r.manager_instructions}</span></div>:null}
          <div className="rx-role-foot"><span>{fmtDate(r.deadline)}</span><Link className="primary-action" href={'/recruiter/requirements/'+r.job_id}>Open role →</Link></div>
        </article>
      }):<div className="rx-empty"><h3>No active recruiter assignments.</h3><p>An Account Manager or Recruitment Manager must assign an approved Step-2 requirement before it appears here.</p></div>}</div>
    </section>

    <div className="rx-two-col">
      <section className="rx-section"><div className="rx-section-head"><div><h2>Due work</h2><p>Operational recruiter tasks only.</p></div></div>
        <div className="rx-list">{tasks.length?tasks.map(t=><article key={t.id} className={t.overdue?'overdue':''}><div><b>{t.title}</b><span>{t.job_title||'Requirement'}{t.candidate_name?' · '+t.candidate_name:''}</span><small>{fmtWhen(t.due_at,ctx.timezone)} · {String(t.task_type||'TASK').replaceAll('_',' ')}</small></div><button onClick={()=>completeTask(t.id)} disabled={state==='saving'}>Done</button></article>):<div className="rx-empty compact">No open recruiter tasks.</div>}</div>
      </section>
      <section className="rx-section"><div className="rx-section-head"><div><h2>Interview actions</h2><p>Already-supported interview events on assigned work.</p></div></div>
        <div className="rx-list">{interviews.length?interviews.map(i=><article key={i.id}><div><b>{i.candidate_name}</b><span>{i.job_title}</span><small>{fmtWhen(i.scheduled_at,i.timezone||ctx.timezone)}</small></div><Link href={'/recruiter/requirements/'+i.job_id}>Open role</Link></article>):<div className="rx-empty compact">No near-term interview actions.</div>}</div>
      </section>
    </div>
    {state!=='idle'&&state!=='saving'&&state!=='saved'?<div className="save-error">Action failed: {state}</div>:null}
  </div>;
}
