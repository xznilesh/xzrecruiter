'use client';

import { useEffect, useMemo, useState } from 'react';

async function crm(action,payload){
  const res=await fetch('/api/crm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,payload})});
  const data=await res.json().catch(()=>({error:'invalid_response'}));
  if(!res.ok) throw new Error(data?.error||'request_failed');
  return data;
}

function normalizeValue(field,value){
  if(value===undefined||value===null) return field.field_type==='CHECKBOX'?false:'';
  if(field.field_type==='MULTI_SELECT') return Array.isArray(value)?value:[];
  if(field.field_type==='CHECKBOX') return Boolean(value);
  return value;
}

function readExisting(values){
  const map={};
  for(const item of values||[]){
    if(item?.field_definition_id) map[item.field_definition_id]=item.value_json ?? item.value ?? null;
    else if(item?.field_id) map[item.field_id]=item.value_json ?? item.value ?? null;
  }
  return map;
}

function FieldInput({field,value,onChange}){
  const common={id:`crm-custom-${field.id}`,'aria-required':field.required||undefined};
  if(field.field_type==='LONG_TEXT') return <textarea {...common} rows="4" value={value||''} onChange={e=>onChange(e.target.value)}/>;
  if(field.field_type==='CHECKBOX') return <label className="crm-custom-check"><input {...common} type="checkbox" checked={Boolean(value)} onChange={e=>onChange(e.target.checked)}/><span>Enabled</span></label>;
  if(field.field_type==='SINGLE_SELECT') return <select {...common} value={value||''} onChange={e=>onChange(e.target.value)}><option value="">Select…</option>{(field.options||[]).map((o,i)=>{const v=typeof o==='string'?o:o?.value??o?.label??String(i);const label=typeof o==='string'?o:o?.label??v;return <option key={`${v}-${i}`} value={v}>{label}</option>})}</select>;
  if(field.field_type==='MULTI_SELECT'){
    const selected=Array.isArray(value)?value:[];
    return <div className="crm-custom-multi">{(field.options||[]).map((o,i)=>{const v=typeof o==='string'?o:o?.value??o?.label??String(i);const label=typeof o==='string'?o:o?.label??v;const active=selected.includes(v);return <button type="button" key={`${v}-${i}`} className={active?'active':''} aria-pressed={active} onClick={()=>onChange(active?selected.filter(x=>x!==v):[...selected,v])}>{label}</button>})}</div>;
  }
  const type=field.field_type==='NUMBER'||field.field_type==='DECIMAL'||field.field_type==='CURRENCY'||field.field_type==='PERCENTAGE'?'number':field.field_type==='DATE'?'date':field.field_type==='DATETIME'?'datetime-local':field.field_type==='EMAIL'?'email':field.field_type==='URL'?'url':field.field_type==='PHONE'?'tel':'text';
  return <input {...common} type={type} value={value??''} onChange={e=>onChange(type==='number'?(e.target.value===''?'':Number(e.target.value)):e.target.value)}/>;
}

export default function CrmCustomFieldsPanel({entityType,entityId,definitions=[],values=[],onSaved}){
  const fields=useMemo(()=>definitions.filter(f=>String(f.module).toUpperCase()===String(entityType).toUpperCase()&&f.active!==false),[definitions,entityType]);
  const [form,setForm]=useState({});
  const [state,setState]=useState('idle');
  const [message,setMessage]=useState('');
  useEffect(()=>{
    const existing=readExisting(values);const next={};
    for(const f of fields) next[f.id]=normalizeValue(f,existing[f.id]??f.default_value);
    setForm(next);setState('idle');setMessage('');
  },[entityId,fields,values]);
  if(!fields.length) return null;
  async function save(){
    const missing=fields.find(field=>field.required&&(form[field.id]===null||form[field.id]===undefined||form[field.id]===''||(Array.isArray(form[field.id])&&!form[field.id].length)));
    if(missing){setState('error');setMessage(`${missing.label} is required`);return;}
    setState('saving');setMessage('');
    try{
      const payload=fields.map(field=>({fieldId:field.id,value:form[field.id]??null}));
      const result=await crm('saveCustomValues',{entityType,entityId,values:payload});
      setState('saved');setMessage('Custom fields saved');onSaved?.(result);
    }catch(e){setState('error');setMessage(e.message||'Could not save custom fields')}
  }
  const groups=new Map();
  for(const field of fields){const key=field.group_id||'ungrouped';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(field)}
  return <section className="crm-card crm-custom-fields-panel">
    <div className="crm-section-title"><div><b>Custom fields</b><small>Workspace-defined business data · validated and stored per record</small></div><span>{fields.length}</span></div>
    {[...groups.entries()].map(([groupId,items])=><div className="crm-custom-group" key={groupId}><div className="crm-custom-grid">{items.sort((a,b)=>(a.sort_order||100)-(b.sort_order||100)).map(field=><label className={`form-control ${field.field_type==='LONG_TEXT'||field.field_type==='MULTI_SELECT'?'wide':''}`} key={field.id} htmlFor={`crm-custom-${field.id}`}><span>{field.label}{field.required?' *':''}</span><FieldInput field={field} value={form[field.id]} onChange={value=>setForm(prev=>({...prev,[field.id]:value}))}/>{field.help_text?<small>{field.help_text}</small>:null}</label>)}</div></div>)}
    <div className="crm-custom-actions"><span className={state==='error'?'save-error':state==='saved'?'save-good':''}>{message}</span><button className="primary-action" type="button" disabled={state==='saving'} onClick={save}>{state==='saving'?'Saving…':'Save custom fields'}</button></div>
  </section>;
}
