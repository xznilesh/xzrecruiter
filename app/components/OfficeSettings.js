'use client';

import { useMemo, useState } from 'react';
import { CountrySelect, TimezoneSelect, TextInput } from '@/app/components/FormControls';

async function saveOffice(payload){
  const res=await fetch('/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'office',payload})});
  const data=await res.json();
  if(!res.ok) throw new Error(data.error||'Could not save office.');
  return data;
}

export default function OfficeSettings({ globalContext, officeContext }) {
  const countries=globalContext.countries||[];
  const timezones=globalContext.timezones||[];
  const settings=globalContext.settings||{};
  const [items,setItems]=useState(officeContext.offices||[]);
  const [draft,setDraft]=useState({name:'',countryCode:settings.country_code||'IN',timezoneId:settings.timezone_id||'Asia/Kolkata',locale:settings.locale||'en-IN',currencyCode:settings.currency_code||'INR',isPrimary:false});
  const [state,setState]=useState('idle');
  const zones=useMemo(()=>timezones.filter((z)=>z.country_code===draft.countryCode),[timezones,draft.countryCode]);

  function chooseCountry(code){
    const country=countries.find((c)=>c.country_code===code);
    const zone=timezones.find((z)=>z.country_code===code&&z.is_default)||timezones.find((z)=>z.country_code===code);
    setDraft({...draft,countryCode:code,timezoneId:zone?.timezone_id||country?.default_timezone||'',locale:country?.default_locale||draft.locale,currencyCode:country?.default_currency||draft.currencyCode});
  }
  async function submit(){
    setState('saving');
    try{
      const result=await saveOffice(draft);
      const next={id:result.id,name:draft.name,country_code:draft.countryCode,timezone_id:draft.timezoneId,locale:draft.locale,currency_code:draft.currencyCode,is_primary:draft.isPrimary,active:true};
      setItems((current)=>[...current.map((o)=>({...o,is_primary:draft.isPrimary?false:o.is_primary})),next]);
      setDraft({...draft,name:'',isPrimary:false});setState('saved');
    }catch{setState('error');}
  }
  return <div className="office-settings"><section className="import-card"><div className="panel-title-row"><div><span className="page-kicker">Global offices</span><h2>Office locations</h2><p className="panel-sub">Every office keeps its own country, BCP‑47 locale, ISO currency and IANA timezone. Australia, Canada and the US are never collapsed to a single zone.</p></div><span className="panel-badge">{items.length} configured</span></div><div className="office-list">{items.map((office)=><article key={office.id}><div><span>{office.is_primary?'Primary office':'Office'}</span><b>{office.name}</b></div><dl><div><dt>Country</dt><dd>{countries.find((c)=>c.country_code===office.country_code)?.country_name||office.country_code}</dd></div><div><dt>Timezone</dt><dd>{office.timezone_id}</dd></div><div><dt>Locale</dt><dd>{office.locale||'Workspace default'}</dd></div><div><dt>Currency</dt><dd>{office.currency_code||'Workspace default'}</dd></div></dl></article>)}</div></section><section className="config-studio"><div className="studio-head"><div><span className="page-kicker">Add office</span><h2>Additional office</h2><p>Use the same Step‑2 global registries as the workspace.</p></div></div><div className="form-grid two"><TextInput label="Office name" name="officeName" value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})} placeholder="Dubai office"/><CountrySelect label="Country" name="officeCountry" countries={countries} value={draft.countryCode} onChange={(e)=>chooseCountry(e.target.value)}/><TimezoneSelect label="Timezone" name="officeTimezone" timezones={zones} value={draft.timezoneId} onChange={(e)=>setDraft({...draft,timezoneId:e.target.value})}/><TextInput label="Locale (BCP-47)" name="officeLocale" value={draft.locale} onChange={(e)=>setDraft({...draft,locale:e.target.value})}/><TextInput label="Currency (ISO)" name="officeCurrency" value={draft.currencyCode} onChange={(e)=>setDraft({...draft,currencyCode:e.target.value.toUpperCase()})}/><label className="form-control"><span>Primary</span><select value={draft.isPrimary?'yes':'no'} onChange={(e)=>setDraft({...draft,isPrimary:e.target.value==='yes'})}><option value="no">Additional office</option><option value="yes">Make primary office</option></select></label></div><button type="button" className="primary-action" disabled={!draft.name||state==='saving'} onClick={submit}>{state==='saving'?'Saving…':'Save office'}</button>{state==='saved'?<span className="save-good">Saved</span>:state==='error'?<span className="save-error">Could not save office.</span>:null}</section></div>;
}
