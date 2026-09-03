'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const cards = [
  ['workspace','Workspace','Agency profile, business model, team size and defaults.','workspace agency business team size','/onboarding?section=profile&edit=1'],
  ['markets','Markets & Localization','Countries, regions, cities, currencies, locales and timezones.','country market timezone currency locale language','/onboarding?section=markets&edit=1'],
  ['offices','Offices','Primary and additional offices with independent IANA timezones.','office location timezone primary additional office','/settings/offices'],
  ['preferences','Recruitment Preferences','Recruiting model, specialties, salary bands and availability.','recruitment preferences salary employment','/onboarding?section=specialization&edit=1'],
  ['industries','Industries','Hierarchical global taxonomy plus agency-specific additions.','industry sub-industry specialization sector',null],
  ['icp','Company ICP','Company size, type, funding, hiring volume and growth preferences.','company size employee size funding stage target account icp','/onboarding?section=icp&edit=1'],
  ['roles','Roles & Skills','Job functions, seniority, roles, skills and languages.','job function seniority role skill language','/onboarding?section=specialization&edit=1'],
  ['candidate','Candidate Profile','Inventory strengths, notice period, countries and work modes.','candidate profile inventory notice','/onboarding?section=candidate&edit=1'],
  ['candidate-auth','Work Authorization Profile','Candidate inventory work-authorization markets and statuses.','candidate work authorization permit sponsorship citizen visa',null],
  ['pipelines','Recruitment Pipelines','Recruitment stages, required fields and rejection reasons.','pipeline workflow stages recruitment','/onboarding?section=pipelines&edit=1'],
  ['bd-pipelines','BD Pipelines','Account-to-placement business development workflow.','business development lead client opportunity pipeline','/onboarding?section=pipelines&edit=1'],
  ['custom-fields','Custom Fields','Create module fields without exposing database internals.','custom fields candidate job company client contact opportunity',null],
  ['layouts','Layouts','Arrange custom fields into module sections and columns.','layout section field groups module columns',null],
  ['teams','Teams','Departments, teams, operating roles and invite configuration.','team department recruiter sourcer manager role','/onboarding?section=team&edit=1'],
  ['territories','Territories','Country, region, city, industry and function routing foundation.','territory country region city industry job function',null],
  ['views','Views','Personal/team saved views with AND/OR filters and column state.','saved view filter columns and or personal team',null],
  ['import','Import','Safe staged CSV import for companies, clients, contacts and candidates.','csv import migration company client contact candidate','/import'],
  ['notifications','Notifications','Notification delivery preferences are reserved for a later workflow step.','notification email alerts',null],
  ['integrations','Integrations','Integration catalog remains intentionally disabled until connector work is implemented.','integration connector api',null]
];

const fieldTypes = ['TEXT','LONG_TEXT','NUMBER','DECIMAL','CURRENCY','PERCENTAGE','DATE','DATETIME','CHECKBOX','SINGLE_SELECT','MULTI_SELECT','EMAIL','PHONE','URL','COUNTRY','TIMEZONE','USER','COMPANY','CANDIDATE','JOB','TAG'];
const moduleOptions = ['CANDIDATE','JOB','COMPANY','CLIENT','CONTACT','OPPORTUNITY'];

async function postConfig(action, payload) {
  const res = await fetch('/api/config', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({action,payload}) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not save configuration.');
  return data;
}

function CustomFieldStudio({ existing=[] }) {
  const [form,setForm] = useState({module:'CANDIDATE',label:'',fieldType:'TEXT',required:false,searchable:false,filterable:true,visibility:'ALL'});
  const [state,setState] = useState('idle');
  const [items,setItems] = useState(existing);
  async function save() {
    setState('saving');
    try {
      const result=await postConfig('customField',form);
      setItems([...items,{...form,id:result.id,field_key:result.field_key,module:form.module,label:form.label,field_type:form.fieldType}]);
      setForm({...form,label:''}); setState('saved');
    } catch { setState('error'); }
  }
  return <section className="config-studio"><div className="studio-head"><div><span className="page-kicker">Advanced setup</span><h2>Custom Fields</h2><p>Persistent field definitions with validation, search/filter behavior and visibility controls.</p></div></div><div className="form-grid two"><label className="form-control"><span>Module</span><select value={form.module} onChange={(e)=>setForm({...form,module:e.target.value})}>{moduleOptions.map((v)=><option key={v}>{v}</option>)}</select></label><label className="form-control"><span>Field type</span><select value={form.fieldType} onChange={(e)=>setForm({...form,fieldType:e.target.value})}>{fieldTypes.map((v)=><option key={v}>{v.replaceAll('_',' ')}</option>)}</select></label><label className="form-control"><span>Label</span><input value={form.label} onChange={(e)=>setForm({...form,label:e.target.value})} placeholder="e.g. Security clearance"/></label><label className="form-control"><span>Visibility</span><select value={form.visibility} onChange={(e)=>setForm({...form,visibility:e.target.value})}>{['ALL','INTERNAL','MANAGERS','ADMINS'].map((v)=><option key={v}>{v}</option>)}</select></label></div><div className="check-row"><label><input type="checkbox" checked={form.required} onChange={(e)=>setForm({...form,required:e.target.checked})}/> Required</label><label><input type="checkbox" checked={form.searchable} onChange={(e)=>setForm({...form,searchable:e.target.checked})}/> Searchable</label><label><input type="checkbox" checked={form.filterable} onChange={(e)=>setForm({...form,filterable:e.target.checked})}/> Filterable</label></div><button className="primary-action" type="button" onClick={save} disabled={!form.label||state==='saving'}>{state==='saving'?'Saving…':'Create field'}</button>{state==='error'?<span className="save-error">Could not save field.</span>:null}<div className="config-list">{items.map((f)=><div key={f.id||`${f.module}-${f.field_key}`}><span>{f.module}</span><b>{f.label}</b><small>{f.field_type||f.fieldType}</small></div>)}</div></section>;
}

function LayoutStudio({ fields=[] }) {
  const [module,setModule]=useState('CANDIDATE');
  const [name,setName]=useState('Default details');
  const [sectionName,setSectionName]=useState('Details');
  const [selected,setSelected]=useState([]);
  const [state,setState]=useState('idle');
  const options=fields.filter((f)=>f.module===module);
  async function save(){
    setState('saving');
    try {
      await postConfig('layout',{module,name,isDefault:true,sections:[{name:sectionName,sortOrder:10,columns:2,visible:true,fields:selected.map((fieldId,index)=>({fieldId,sortOrder:(index+1)*10,width:'HALF'}))}]});
      setState('saved');
    } catch { setState('error'); }
  }
  return <section className="config-studio"><div className="studio-head"><div><span className="page-kicker">Advanced setup</span><h2>Module Layout</h2><p>Group and order agency custom fields without exposing database columns.</p></div></div><div className="form-grid two"><label className="form-control"><span>Module</span><select value={module} onChange={(e)=>{setModule(e.target.value);setSelected([])}}>{moduleOptions.map((v)=><option key={v}>{v}</option>)}</select></label><label className="form-control"><span>Layout name</span><input value={name} onChange={(e)=>setName(e.target.value)}/></label><label className="form-control"><span>Section name</span><input value={sectionName} onChange={(e)=>setSectionName(e.target.value)}/></label></div><div className="check-row layout-field-options">{options.length?options.map((f)=><label key={f.id}><input type="checkbox" checked={selected.includes(f.id)} onChange={()=>setSelected((v)=>v.includes(f.id)?v.filter((x)=>x!==f.id):[...v,f.id])}/>{f.label}</label>):<span className="quiet-copy">Create custom fields for this module first.</span>}</div><button className="primary-action" type="button" disabled={!name||!sectionName||state==='saving'} onClick={save}>{state==='saving'?'Saving…':'Save layout'}</button>{state==='saved'?<span className="save-good">Layout saved</span>:state==='error'?<span className="save-error">Could not save layout.</span>:null}</section>;
}

function CandidateAuthorizationStudio({ countries=[], taxonomies=[] }) {
  const [selectedCountries,setSelectedCountries]=useState([]);
  const [statuses,setStatuses]=useState([]);
  const [state,setState]=useState('idle');
  const statusOptions=taxonomies.filter((t)=>t.domain==='WORK_AUTHORIZATION_STATUS');
  async function save(){setState('saving');try{await postConfig('candidateAuthorization',{countries:selectedCountries,statuses});setState('saved')}catch{setState('error')}}
  return <section className="config-studio"><div className="studio-head"><div><span className="page-kicker">Candidate inventory</span><h2>Work Authorization Profile</h2><p>Describe markets your candidate inventory can serve. XZRecruiter stores facts only and does not make immigration/legal decisions.</p></div></div><div className="selection-grid compact-selection">{countries.map((c)=><button type="button" key={c.country_code} className={selectedCountries.includes(c.country_code)?'selected':''} onClick={()=>setSelectedCountries((v)=>v.includes(c.country_code)?v.filter((x)=>x!==c.country_code):[...v,c.country_code])}><span>{c.country_name}</span>{selectedCountries.includes(c.country_code)?<b>✓</b>:null}</button>)}</div><div className="check-row">{statusOptions.map((s)=><label key={s.code}><input type="checkbox" checked={statuses.includes(s.code)} onChange={()=>setStatuses((v)=>v.includes(s.code)?v.filter((x)=>x!==s.code):[...v,s.code])}/>{s.label}</label>)}</div><button className="primary-action" type="button" disabled={!selectedCountries.length||state==='saving'} onClick={save}>{state==='saving'?'Saving…':'Save authorization profile'}</button>{state==='saved'?<span className="save-good">Saved</span>:state==='error'?<span className="save-error">Could not save.</span>:null}</section>;
}

function TerritoryStudio({ countries=[],taxonomies=[],existing=[] }) {
  const [name,setName]=useState(''); const [country,setCountry]=useState(''); const [industry,setIndustry]=useState(''); const [functionCode,setFunctionCode]=useState(''); const [items,setItems]=useState(existing); const [state,setState]=useState('idle');
  async function save(){setState('saving');const rules=[];if(country)rules.push({dimension:'COUNTRY',operator:'IN',values:[country]});if(industry)rules.push({dimension:'INDUSTRY',operator:'IN',values:[industry]});if(functionCode)rules.push({dimension:'JOB_FUNCTION',operator:'IN',values:[functionCode]});try{const result=await postConfig('territory',{name,rules});setItems([...items,{id:result.id,name,rules}]);setName('');setState('saved')}catch{setState('error')}}
  return <section className="config-studio"><div className="studio-head"><div><span className="page-kicker">Foundation</span><h2>Territories</h2><p>Build transparent routing rules now; complex automated assignment comes later.</p></div></div><div className="form-grid two"><label className="form-control"><span>Territory name</span><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="London Technology Recruitment"/></label><label className="form-control"><span>Country</span><select value={country} onChange={(e)=>setCountry(e.target.value)}><option value="">Any country</option>{countries.map((c)=><option key={c.country_code} value={c.country_code}>{c.country_name}</option>)}</select></label><label className="form-control"><span>Industry</span><select value={industry} onChange={(e)=>setIndustry(e.target.value)}><option value="">Any industry</option>{taxonomies.filter((t)=>t.domain==='INDUSTRY').map((t)=><option key={t.id} value={t.code}>{t.label}</option>)}</select></label><label className="form-control"><span>Job function</span><select value={functionCode} onChange={(e)=>setFunctionCode(e.target.value)}><option value="">Any function</option>{taxonomies.filter((t)=>t.domain==='JOB_FUNCTION').map((t)=><option key={t.id} value={t.code}>{t.label}</option>)}</select></label></div><button className="primary-action" type="button" disabled={!name||state==='saving'} onClick={save}>{state==='saving'?'Saving…':'Create territory'}</button><div className="config-list">{items.map((t)=><div key={t.id}><span>Territory</span><b>{t.name}</b><small>{(t.rules||[]).length} rules</small></div>)}</div></section>;
}

function ViewStudio({ existing=[] }) {
  const [name,setName]=useState(''); const [module,setModule]=useState('CANDIDATE'); const [scope,setScope]=useState('PERSONAL'); const [field,setField]=useState('status'); const [value,setValue]=useState(''); const [logic,setLogic]=useState('AND'); const [items,setItems]=useState(existing); const [state,setState]=useState('idle');
  async function save(){setState('saving');try{const result=await postConfig('savedView',{module,name,scope,filterLogic:logic,filters:value?[{field,operator:'EQUALS',value}]:[],sort:[],visibleColumns:[],columnOrder:[]});setItems([...items,{id:result.id,module,name,scope}]);setName('');setState('saved')}catch{setState('error')}}
  return <section className="config-studio"><div className="studio-head"><div><span className="page-kicker">EnterpriseTable</span><h2>Saved Views</h2><p>Persist personal or team view definitions for future list modules.</p></div></div><div className="form-grid two"><label className="form-control"><span>View name</span><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Candidates available now"/></label><label className="form-control"><span>Module</span><select value={module} onChange={(e)=>setModule(e.target.value)}>{moduleOptions.map((v)=><option key={v}>{v}</option>)}</select></label><label className="form-control"><span>Scope</span><select value={scope} onChange={(e)=>setScope(e.target.value)}><option value="PERSONAL">Personal</option><option value="TEAM">Shared / team</option></select></label><label className="form-control"><span>Filter logic</span><select value={logic} onChange={(e)=>setLogic(e.target.value)}><option>AND</option><option>OR</option></select></label><label className="form-control"><span>Filter field</span><input value={field} onChange={(e)=>setField(e.target.value)}/></label><label className="form-control"><span>Filter value</span><input value={value} onChange={(e)=>setValue(e.target.value)}/></label></div><button className="primary-action" type="button" disabled={!name||state==='saving'} onClick={save}>{state==='saving'?'Saving…':'Save view'}</button><div className="config-list">{items.map((v)=><div key={v.id}><span>{v.module}</span><b>{v.name}</b><small>{v.scope}</small></div>)}</div></section>;
}

function IndustryStudio({ taxonomies=[] }) {
  const [label,setLabel]=useState(''); const [parentId,setParentId]=useState(''); const [state,setState]=useState('idle'); const [created,setCreated]=useState([]);
  async function save(){setState('saving');try{const result=await postConfig('customTaxonomy',{domain:'INDUSTRY',parentId:parentId||null,label});setCreated([...created,result]);setLabel('');setState('saved')}catch{setState('error')}}
  return <section className="config-studio"><div className="studio-head"><div><span className="page-kicker">Agency taxonomy</span><h2>Add custom industry</h2><p>Create an agency-owned child without changing the global taxonomy.</p></div></div><div className="form-grid two"><label className="form-control"><span>Parent industry</span><select value={parentId} onChange={(e)=>setParentId(e.target.value)}><option value="">Top level</option>{taxonomies.filter((t)=>t.domain==='INDUSTRY').map((t)=><option key={t.id} value={t.id}>{'—'.repeat(t.level||0)} {t.label}</option>)}</select></label><label className="form-control"><span>New label</span><input value={label} onChange={(e)=>setLabel(e.target.value)} placeholder="e.g. ClimateTech"/></label></div><button className="primary-action" type="button" onClick={save} disabled={!label||state==='saving'}>{state==='saving'?'Saving…':'Add industry'}</button>{created.map((x)=><span className="created-chip" key={x.id}>✓ {x.label}</span>)}</section>;
}

export default function SettingsCenter({ onboarding,globalContext,initialFocus='' }) {
  const [query,setQuery]=useState(''); const [focus,setFocus]=useState(initialFocus);
  const filtered=useMemo(()=>cards.filter(([,title,desc,keywords])=>`${title} ${desc} ${keywords}`.toLowerCase().includes(query.toLowerCase())),[query]);
  const inlineKeys=['custom-fields','layouts','candidate-auth','territories','views','industries'];
  return <div className="settings-center"><div className="page-heading"><div><span className="page-kicker">Configuration Center</span><h1>Powerful without configuration overload.</h1><p>Search the setting you need, change it directly, and keep Step‑2 globalization underneath every market-aware control.</p></div><Link className="small-action" href="/onboarding?edit=1">Reopen guided setup</Link></div><label className="settings-search"><span>⌕</span><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search settings — try “company size”"/></label><div className="settings-grid">{filtered.map(([key,title,desc,,href])=><article key={key} className={focus===key?'focused':''}><div><span className="settings-icon">{key==='markets'?'◎':key==='pipelines'?'≋':key==='custom-fields'?'＋':'◇'}</span><h2>{title}</h2><p>{desc}</p></div>{href?<Link href={href}>Open →</Link>:inlineKeys.includes(key)?<button type="button" onClick={()=>setFocus(key)}>Configure →</button>:<span className="coming-chip">Later step</span>}</article>)}</div>
    {focus==='custom-fields'?<CustomFieldStudio existing={onboarding.custom_fields}/>:null}
    {focus==='layouts'?<LayoutStudio fields={onboarding.custom_fields||[]}/>:null}
    {focus==='candidate-auth'?<CandidateAuthorizationStudio countries={globalContext.countries||[]} taxonomies={onboarding.taxonomies||[]}/>:null}
    {focus==='territories'?<TerritoryStudio countries={globalContext.countries||[]} taxonomies={onboarding.taxonomies||[]} existing={onboarding.territories||[]}/>:null}
    {focus==='views'?<ViewStudio existing={onboarding.saved_views||[]}/>:null}
    {focus==='industries'?<IndustryStudio taxonomies={onboarding.taxonomies||[]}/>:null}
  </div>;
}
