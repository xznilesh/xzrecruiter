'use client';

import { useEffect,useMemo,useState } from 'react';
import Link from 'next/link';

const list=v=>Array.isArray(v)?v:[];
const pretty=v=>String(v||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
const when=v=>v?new Date(v).toLocaleString():'—';

async function load(){
  const res=await fetch('/api/manager-control?mode=notifications',{cache:'no-store'});
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
function Severity({value}){const k=String(value||'INFO');return <span className={'mc-severity '+k.toLowerCase()}>{pretty(k)}</span>}

export default function AutomationNotificationCenter({initialData}){
  const[data,setData]=useState(initialData||{notifications:[]});
  const[state,setState]=useState('idle');
  const[message,setMessage]=useState('');
  const[filter,setFilter]=useState('ALL');

  async function refresh({silent=false}={}){
    if(!silent){setState('loading');setMessage('')}
    try{setData(await load());if(!silent){setState('saved');setMessage('Notifications refreshed.')}}
    catch(e){if(!silent){setState('error');setMessage(e.message)}}
  }
  useEffect(()=>{const timer=setInterval(()=>refresh({silent:true}),30000);return()=>clearInterval(timer)},[]);
  async function act(id,alertAction){
    setState('loading');setMessage('');
    try{await post({action:'alertAction',alertId:id,alertAction});await refresh({silent:true});setState('saved');setMessage('Alert '+alertAction.toLowerCase()+'d.')}
    catch(e){setState('error');setMessage(e.message)}
  }
  const rows=useMemo(()=>{
    const all=list(data.notifications);
    return filter==='ALL'?all:all.filter(x=>x.severity===filter);
  },[data,filter]);

  return <div className="manager-control">
    <div className="page-heading">
      <div><span className="page-kicker">Automation action center</span><h1>Notifications</h1><p>Only current operational exceptions that you are authorized to see. Resolved issues disappear automatically.</p></div>
      <div className="mc-heading-actions"><button className="ghost-action" onClick={()=>refresh()} disabled={state==='loading'}>Refresh</button>{['OWNER','ADMIN','RECRUITMENT_MANAGER','ACCOUNT_MANAGER'].includes(String(data.role||''))?<Link className="primary-action" href="/manager">Manager control</Link>:null}</div>
    </div>
    {message?<div className={state==='error'?'save-error profile-error':'pipeline-feedback success'} role="status">{message}</div>:null}
    <div className="mc-filter-row">{['ALL','URGENT','ATTENTION','INFO'].map(x=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)}>{pretty(x)} {x==='ALL'?list(data.notifications).length:list(data.notifications).filter(n=>n.severity===x).length}</button>)}</div>

    {rows.length?<div className="mc-notification-list">{rows.map(x=><article key={x.id}>
      <div className="mc-notification-head"><Severity value={x.severity}/><b>{pretty(x.category)}</b><span>{pretty(x.lifecycle)}</span><time>{when(x.last_detected_at)}</time></div>
      <h2>{x.reason_summary}</h2>
      <p>{x.recommended_action}</p>
      <div className="mc-reasons">{list(x.reason_codes).map(r=><span key={r}>{pretty(r)}</span>)}</div>
      <div className="mc-notification-meta"><span>Due: {when(x.due_at)}</span><span>Seen {Number(x.occurrence_count||1)}×</span></div>
      <div className="mc-row-actions">{x.job_id&&['OWNER','ADMIN','RECRUITMENT_MANAGER','ACCOUNT_MANAGER'].includes(String(data.role||''))?<Link href={'/manager/requirements/'+x.job_id}>Open requirement</Link>:null}{x.lifecycle!=='ACKNOWLEDGED'?<button onClick={()=>act(x.id,'ACKNOWLEDGE')}>Acknowledge</button>:null}<button onClick={()=>act(x.id,'DISMISS')}>Dismiss</button></div>
    </article>)}</div>:<div className="ats-empty">No active notifications in this filter.</div>}
  </div>;
}
