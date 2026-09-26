'use client';

import { useEffect,useState } from 'react';
import Link from 'next/link';

const list=v=>Array.isArray(v)?v:[];
const n=v=>Number(v||0);
const pretty=v=>String(v||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
const when=v=>v?new Date(v).toLocaleString():'—';
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(16).slice(2);

async function getContext(jobId){
  const res=await fetch('/api/manager-control?mode=requirement&jobId='+encodeURIComponent(jobId),{cache:'no-store'});
  const data=await res.json().catch(()=>({error:'invalid_response'}));
  if(!res.ok)throw new Error(data?.error||'request_failed');
  return data;
}
async function post(body){
  const res=await fetch('/api/manager-control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({error:'invalid_response'}));
  if(!res.ok)throw new Error(data?.error||'request_failed');
  return data;
}
function Health({value}){const k=String(value||'HEALTHY');return <span className={'mc-health '+k.toLowerCase()}>{pretty(k)}</span>}
function Severity({value}){const k=String(value||'INFO');return <span className={'mc-severity '+k.toLowerCase()}>{pretty(k)}</span>}

export default function ManagerRequirementControl({jobId,initialContext}){
  const[ctx,setCtx]=useState(initialContext||{});
  const[state,setState]=useState('idle');
  const[message,setMessage]=useState('');
  const[priority,setPriority]=useState(initialContext?.job?.priority||'NORMAL');
  const[assign,setAssign]=useState({recruiterUserId:'',dailyTarget:'0',totalTarget:'0',priority:'NORMAL',context:'',instructions:''});
  const[task,setTask]=useState({assignedUserId:'',title:'',description:'',priority:'NORMAL',dueAt:''});
  const idempotencyRef=useState(()=>uid())[0];

  async function refresh({silent=false}={}){
    if(!silent){setState('loading');setMessage('')}
    try{const data=await getContext(jobId);setCtx(data);setPriority(data.job?.priority||'NORMAL');if(!silent){setState('saved');setMessage('Requirement control refreshed.')}}
    catch(e){if(!silent){setState('error');setMessage(e.message)}}
  }
  useEffect(()=>{const timer=setInterval(()=>refresh({silent:true}),30000);return()=>clearInterval(timer)},[jobId]);

  async function managerAction(managerAction,payload={}){
    setState('loading');setMessage('');
    try{
      await post({action:'managerAction',managerAction,payload:{jobId,...payload}});
      await refresh({silent:true});setState('saved');setMessage(pretty(managerAction)+' applied and audit logged.');
    }catch(e){setState('error');setMessage(e.message)}
  }
  async function alertAction(alertId,alertAction){
    setState('loading');setMessage('');
    try{await post({action:'alertAction',alertId,alertAction});await refresh({silent:true});setState('saved');setMessage('Exception '+alertAction.toLowerCase()+'d.')}
    catch(e){setState('error');setMessage(e.message)}
  }
  async function createTask(){
    await managerAction('CREATE_MANAGER_TASK',{...task,idempotencyKey:idempotencyRef});
    setTask(x=>({...x,title:'',description:''}));
  }

  const canControl=['OWNER','ADMIN','RECRUITMENT_MANAGER'].includes(String(ctx.role||''));
  const job=ctx.job||{},health=ctx.health||{},pipeline=ctx.pipeline||{};
  const assignments=list(ctx.assignments),alerts=list(ctx.exceptions),activity=list(ctx.activity),eligible=list(ctx.eligibleRecruiters);
  const reasons=list(health.reason_codes),actions=list(health.next_actions);

  return <div className="manager-control">
    <div className="page-heading">
      <div><span className="page-kicker">Manager requirement control</span><h1>{job.title||'Requirement'}</h1><p>{job.client||'Client not set'} · {job.deadline||'No deadline'} · canonical operational control</p></div>
      <div className="mc-heading-actions"><Link className="ghost-action" href="/manager">← Manager control</Link><button className="ghost-action" onClick={()=>refresh()} disabled={state==='loading'}>Refresh</button></div>
    </div>
    {message?<div className={state==='error'?'save-error profile-error':'pipeline-feedback success'} role="status">{message}</div>:null}

    <section className="mc-requirement-hero">
      <div><span>Health</span><Health value={health.health_status}/><small>{when(health.computed_at)}</small></div>
      <div><span>Priority</span><b>{pretty(job.priority)}</b></div>
      <div><span>Daily target</span><b>{n(job.dailyTarget)}</b></div>
      <div><span>Total target</span><b>{n(job.totalTarget)}</b></div>
      <div><span>Status</span><b>{pretty(job.status)}</b></div>
    </section>

    {canControl?<div className="mc-grid two">
      <section className="mc-card">
        <div className="mc-section-title"><div><span className="page-kicker">Why this health</span><h2>{pretty(health.health_status||'HEALTHY')}</h2></div></div>
        <div className="mc-reasons">{reasons.length?reasons.map(x=><span key={x}>{pretty(x)}</span>):<span>No active health reason</span>}</div>
        <dl className="mc-definition">
          {Object.entries(health.facts||{}).map(([k,v])=><div key={k}><dt>{pretty(k)}</dt><dd>{typeof v==='number'?v:String(v)}</dd></div>)}
        </dl>
      </section>
      <section className="mc-card">
        <div className="mc-section-title"><div><span className="page-kicker">Next operational actions</span><h2>Grounded recommendations</h2></div></div>
        {actions.length?<div className="mc-action-list">{actions.map((a,i)=><article key={a.code||i}><b>{a.text}</b><p>{a.why}</p></article>)}</div>:<div className="ats-empty">No exception-driven action required.</div>}
      </section>
    </div>

    <section className="mc-card">
      <div className="mc-section-title"><div><span className="page-kicker">Funnel control</span><h2>Where candidates are now</h2></div></div>
      <div className="mc-pipeline">{[
        ['Sourced',pipeline.sourced],['Screening',pipeline.screening],['Qualified',pipeline.qualified],
        ['Internal submitted',pipeline.internalSubmitted],['AM approved',pipeline.amApproved],
        ['Client submitted',pipeline.clientSubmitted],['Interviews',pipeline.interviews],['Offers',pipeline.offers],['Joinings',pipeline.joinings]
      ].map(([label,value])=><div key={label}><span>{label}</span><b>{n(value)}</b></div>)}</div>
    </section>

    <section className="mc-card">
      <div className="mc-section-title"><div><span className="page-kicker">Assigned recruiters</span><h2>Targets, pipeline and due actions</h2></div></div>
      {assignments.length?<div className="mc-assignment-list">{assignments.map(a=><article key={a.id}>
        <div><b>{a.recruiter}</b><small>{pretty(a.manager_priority)} · assigned {when(a.assigned_at)}</small></div>
        <div><span>Today</span><b>{n(a.submissions_today)}/{n(a.daily_submission_target)}</b><small>{n(a.remaining_target)} remaining · {n(a.achievement_percent)}%</small></div>
        <div><span>Pipeline</span><b>{n(a.pipeline)}</b></div>
        <div><span>Overdue</span><b>{n(a.due_actions)}</b></div>
        {canControl?<div className="mc-row-actions"><button onClick={()=>managerAction('SET_RECRUITER_TARGET',{recruiterUserId:a.recruiter_user_id,dailyTarget:a.daily_submission_target,totalTarget:a.total_submission_target})}>Re-save target</button>{a.blocker_reason?<button onClick={()=>managerAction('ACKNOWLEDGE_BLOCKER',{recruiterUserId:a.recruiter_user_id})}>Acknowledge blocker</button>:null}</div>:null}
        {a.blocker_reason?<p className="mc-blocker">Blocked: {a.blocker_reason}</p>:null}
      </article>)}</div>:<div className="ats-empty">No active recruiter assignment.</div>}
    </section>

    <div className="mc-grid two">
      <section className="mc-card">
        <div className="mc-section-title"><div><span className="page-kicker">Manager intervention</span><h2>Requirement controls</h2></div></div>
        <div className="mc-form">
          <label><span>Priority</span><select value={priority} onChange={e=>setPriority(e.target.value)}>{['LOW','NORMAL','HIGH','URGENT'].map(x=><option key={x}>{x}</option>)}</select></label>
          <button onClick={()=>managerAction('SET_PRIORITY',{priority})}>Set priority</button>
          {String(job.status).toUpperCase()==='ON_HOLD'?<button onClick={()=>managerAction('REOPEN_REQUIREMENT')}>Reopen requirement</button>:<button onClick={()=>managerAction('HOLD_REQUIREMENT',{reason:'Manager operational hold'})}>Place on hold</button>}
        </div>
      </section>

      <section className="mc-card">
        <div className="mc-section-title"><div><span className="page-kicker">Assignment control</span><h2>Assign / update recruiter</h2></div></div>
        <div className="mc-form">
          <label><span>Recruiter</span><select value={assign.recruiterUserId} onChange={e=>setAssign({...assign,recruiterUserId:e.target.value})}><option value="">Select recruiter</option>{eligible.map(x=><option key={x.userId} value={x.userId}>{x.name} · {pretty(x.role)}</option>)}</select></label>
          <label><span>Daily target</span><input type="number" min="0" max="1000" value={assign.dailyTarget} onChange={e=>setAssign({...assign,dailyTarget:e.target.value})}/></label>
          <label><span>Total target</span><input type="number" min="0" max="10000" value={assign.totalTarget} onChange={e=>setAssign({...assign,totalTarget:e.target.value})}/></label>
          <label><span>Priority</span><select value={assign.priority} onChange={e=>setAssign({...assign,priority:e.target.value})}>{['LOW','NORMAL','HIGH','URGENT'].map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="wide"><span>Context</span><input value={assign.context} onChange={e=>setAssign({...assign,context:e.target.value})} placeholder="Why this assignment matters"/></label>
          <label className="wide"><span>Instructions</span><textarea rows="3" value={assign.instructions} onChange={e=>setAssign({...assign,instructions:e.target.value})}/></label>
          <button disabled={!assign.recruiterUserId} onClick={()=>managerAction('ASSIGN_RECRUITER',assign)}>Save assignment</button>
        </div>
      </section>
    </div>:null}

    {canControl?<section className="mc-card">
      <div className="mc-section-title"><div><span className="page-kicker">Request action</span><h2>Create manager task</h2></div></div>
      <div className="mc-form task">
        <label><span>Assignee</span><select value={task.assignedUserId} onChange={e=>setTask({...task,assignedUserId:e.target.value})}><option value="">Unassigned</option>{eligible.map(x=><option key={x.userId} value={x.userId}>{x.name}</option>)}</select></label>
        <label><span>Priority</span><select value={task.priority} onChange={e=>setTask({...task,priority:e.target.value})}>{['LOW','NORMAL','HIGH','URGENT'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Due</span><input type="datetime-local" value={task.dueAt} onChange={e=>setTask({...task,dueAt:e.target.value?new Date(e.target.value).toISOString():''})}/></label>
        <label className="wide"><span>Title</span><input value={task.title} onChange={e=>setTask({...task,title:e.target.value})} placeholder="Action required"/></label>
        <label className="wide"><span>Context</span><textarea rows="3" value={task.description} onChange={e=>setTask({...task,description:e.target.value})}/></label>
        <button disabled={!task.title.trim()} onClick={createTask}>Create task</button>
      </div>
    </section>:null}

    <section className="mc-card">
      <div className="mc-section-title"><div><span className="page-kicker">Exceptions</span><h2>Open alerts for this requirement</h2></div></div>
      {alerts.length?<div className="mc-exception-list">{alerts.map(x=><article key={x.id}><div className="mc-exception-head"><Severity value={x.severity}/><b>{pretty(x.category)}</b><span>{x.owner||'Unassigned'}</span><small>{when(x.first_detected_at)}</small></div><h3>{x.reason_summary}</h3><p>{x.recommended_action}</p><div className="mc-row-actions"><button onClick={()=>alertAction(x.id,'ACKNOWLEDGE')}>Acknowledge</button><button onClick={()=>alertAction(x.id,'DISMISS')}>Dismiss</button></div></article>)}</div>:<div className="ats-empty">No open exceptions.</div>}
    </section>

    <section className="mc-card">
      <div className="mc-section-title"><div><span className="page-kicker">Meaningful activity</span><h2>Recent operational events</h2></div></div>
      {activity.length?<div className="mc-activity">{activity.map((x,i)=><article key={i}><div><b>{pretty(x.action)}</b><span>{x.summary}</span></div><time>{when(x.occurred_at)}</time></article>)}</div>:<div className="ats-empty">No recent activity.</div>}
    </section>
  </div>;
}
