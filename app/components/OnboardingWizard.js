'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Brand from '@/app/components/Brand';
import { CountrySelect, TimezoneSelect, SelectInput, TextInput, TagsInput, SalaryRangeInput } from '@/app/components/FormControls';

const requiredSteps = new Set(['profile','markets','industries','icp','specialization','pipelines']);
const stepMeta = {
  profile: ['Agency profile','Tell XZRecruiter who you are.'],
  markets: ['Markets','Choose where you recruit.'],
  industries: ['Industries','Define your sector expertise.'],
  icp: ['Company ICP','Describe the accounts you want.'],
  specialization: ['Recruitment focus','Roles, levels and skills you recruit.'],
  candidate: ['Candidate inventory','Describe the talent you already know.'],
  pipelines: ['Workflows','Configure recruitment and BD stages.'],
  team: ['Team','Structure recruiters and invite teammates.'],
  import: ['Import','Bring in a safe starter dataset.'],
  review: ['Review','Confirm the workspace XZRecruiter should create.']
};

const businessModelOptions = [
  ['RECRUITMENT_AGENCY','Recruitment Agency'],['STAFFING_AGENCY','Staffing Agency'],['PERMANENT_RECRUITMENT','Permanent Recruitment'],
  ['TEMPORARY_STAFFING','Temporary Staffing'],['CONTRACT_RECRUITMENT','Contract Recruitment'],['EXECUTIVE_SEARCH','Executive Search'],
  ['RPO','RPO'],['INTERNAL_TALENT_ACQUISITION','Internal Talent Acquisition'],['HR_CONSULTANCY','HR Consultancy'],
  ['SPECIALIST_AGENCY','Specialist Agency'],['MIXED_RECRUITMENT_BUSINESS','Mixed Recruitment Business']
].map(([value,label]) => ({ value,label }));

function toggle(list, value) { return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]; }
function cleanArray(value) { return Array.isArray(value) ? value : []; }

function initialDrafts(user, globalContext, onboarding) {
  const saved = onboarding.section_state || {};
  const settings = globalContext.settings || {};
  const marketRows = cleanArray(onboarding.markets).filter((m) => m.target_kind === 'RECRUITING').map((m) => ({
    countryCode: m.country_code, region: m.region || '', city: m.city || '', marketType: m.market_type || 'ANY',
    priority: m.priority || 'SECONDARY', timezoneId: m.timezone_id || '', preferred: !!m.preferred, targetKind: 'RECRUITING'
  }));
  const prefs = cleanArray(onboarding.taxonomy_preferences);
  const prefCodes = (context, domain) => prefs.filter((p) => p.context === context && p.domain === domain).map((p) => p.code);
  const specs = cleanArray(onboarding.specializations);
  const specText = (context, type) => specs.filter((s) => s.context === context && s.item_type === type).map((s) => s.text_value || s.country_code).filter(Boolean);
  const salary = (context) => specs.find((s) => s.context === context && s.item_type === 'SALARY_BAND') || {};
  const notice = specs.find((s) => s.context === 'CANDIDATE' && s.item_type === 'NOTICE_PERIOD') || {};
  const profile = onboarding.profile || {};
  const icp = onboarding.icp || {};

  const defaults = {
    profile: {
      workspaceName: user.agency_name || 'Recruiter workspace', businessName: profile.business_name || user.agency_name || '', website: profile.website || '',
      countryCode: settings.country_code || 'IN', locale: settings.locale || 'en-IN', currencyCode: settings.currency_code || 'INR',
      timezoneId: settings.timezone_id || 'Asia/Kolkata', languageCode: settings.language_code || 'en', teamSize: profile.team_size || '', recruiterCount: profile.recruiter_count || '',
      businessModels: cleanArray(onboarding.business_models), setupMode: onboarding.progress?.setup_mode || profile.setup_mode || 'QUICK', terminologyMode: profile.terminology_mode || 'AUTO', offices: []
    },
    markets: { markets: marketRows.length ? marketRows : [{ countryCode: settings.country_code || 'IN', region: '', city: '', marketType: 'ANY', priority: 'PRIMARY', timezoneId: settings.timezone_id || '', preferred: true, targetKind: 'RECRUITING' }] },
    industries: { industries: prefCodes('INDUSTRY','INDUSTRY') },
    icp: { companySizes: prefCodes('ICP','COMPANY_SIZE'), companyTypes: prefCodes('ICP','COMPANY_TYPE'), fundingStages: prefCodes('ICP','FUNDING_STAGE'), industries: prefCodes('ICP','INDUSTRY'), employeeGrowth: icp.employee_growth_preference || 'ANY', hiringVolume: icp.hiring_volume_preference || 'ANY', remotePreference: icp.remote_first_preference || 'ANY', companyScope: icp.company_scope || 'ANY', revenueBands: icp.revenue_bands || [], notes: icp.notes || '' },
    specialization: { jobFunctions: prefCodes('RECRUITMENT','JOB_FUNCTION'), seniority: prefCodes('RECRUITMENT','SENIORITY'), employmentTypes: prefCodes('RECRUITMENT','EMPLOYMENT_TYPE'), industries: prefCodes('RECRUITMENT','INDUSTRY'), skills: specText('RECRUITMENT','SKILL'), roles: specText('RECRUITMENT','ROLE'), languages: specText('RECRUITMENT','LANGUAGE'), countries: specText('RECRUITMENT','COUNTRY'), workplace: specText('RECRUITMENT','WORKPLACE'), currencyCode: salary('RECRUITMENT').currency_code || settings.currency_code || 'INR', salaryMin: salary('RECRUITMENT').amount_min || '', salaryMax: salary('RECRUITMENT').amount_max || '' },
    candidate: { jobFunctions: prefCodes('CANDIDATE','JOB_FUNCTION'), seniority: prefCodes('CANDIDATE','SENIORITY'), employmentTypes: prefCodes('CANDIDATE','EMPLOYMENT_TYPE'), industries: prefCodes('CANDIDATE','INDUSTRY'), skills: specText('CANDIDATE','SKILL'), roles: specText('CANDIDATE','ROLE'), languages: specText('CANDIDATE','LANGUAGE'), countries: specText('CANDIDATE','COUNTRY'), workplace: specText('CANDIDATE','WORKPLACE'), currencyCode: salary('CANDIDATE').currency_code || settings.currency_code || 'INR', salaryMin: salary('CANDIDATE').amount_min || '', salaryMax: salary('CANDIDATE').amount_max || '', noticeDaysMin: notice.notice_days_min || '', noticeDaysMax: notice.notice_days_max || '' },
    pipelines: { ready: true },
    team: { departments: cleanArray(onboarding.departments).map((d) => d.name), teams: cleanArray(onboarding.teams).map((t) => ({ name: t.name, department: '' })), invites: cleanArray(onboarding.invitations).map((i) => ({ email: i.email, rbacRole: i.rbac_role, businessRole: i.business_role })) },
    import: { visited: false }, review: {}
  };
  for (const key of Object.keys(defaults)) if (saved[key]?.payload) defaults[key] = { ...defaults[key], ...saved[key].payload };
  return defaults;
}

function SearchMultiSelect({ label, options, value, onChange, placeholder = 'Search…', hierarchy = false }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !q || `${o.label} ${o.code || ''}`.toLowerCase().includes(q)).slice(0, 80);
  }, [options, query]);
  return <div className="setup-control"><label>{label}</label><div className="setup-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} /></div><div className="selection-grid">{shown.map((o) => <button type="button" key={o.value} className={value.includes(o.value) ? 'selected' : ''} onClick={() => onChange(toggle(value,o.value))}><span style={hierarchy ? { paddingInlineStart: `${(o.level || 0) * 14}px` } : undefined}>{hierarchy && o.level ? '↳ ' : ''}{o.label}</span>{value.includes(o.value) ? <b>✓</b> : null}</button>)}</div>{value.length ? <small>{value.length} selected</small> : null}</div>;
}

function MarketSelector({ countries, timezones, value, onChange }) {
  const [query, setQuery] = useState('');
  const selected = new Set(value.map((m) => m.countryCode));
  const filtered = countries.filter((c) => c.country_name.toLowerCase().includes(query.toLowerCase())).slice(0, 40);
  function add(country) {
    if (selected.has(country.country_code)) return;
    const zone = timezones.find((z) => z.country_code === country.country_code && z.is_default) || timezones.find((z) => z.country_code === country.country_code);
    onChange([...value, { countryCode: country.country_code, region: '', city: '', marketType: 'ANY', priority: value.length ? 'SECONDARY' : 'PRIMARY', timezoneId: zone?.timezone_id || country.default_timezone || '', preferred: value.length === 0, targetKind: 'RECRUITING' }]);
  }
  function patch(index, next) { onChange(value.map((m,i) => i === index ? { ...m, ...next } : m)); }
  return <div className="market-builder"><div className="setup-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a country and add it" /></div><div className="country-quick-grid">{filtered.map((c) => <button type="button" key={c.country_code} disabled={selected.has(c.country_code)} onClick={() => add(c)}><b>{c.country_name}</b><span>{c.country_code} · {c.default_currency}</span>{selected.has(c.country_code) ? <small>Added</small> : <small>Add market</small>}</button>)}</div><div className="market-cards">{value.map((m,index) => { const country = countries.find((c) => c.country_code === m.countryCode); const zones = timezones.filter((z) => z.country_code === m.countryCode); return <article className="market-card" key={`${m.countryCode}-${index}`}><div className="market-card-head"><div><b>{country?.country_name || m.countryCode}</b><span>{m.priority === 'PRIMARY' ? 'Primary market' : 'Secondary market'}</span></div><button type="button" onClick={() => onChange(value.filter((_,i) => i !== index))} disabled={value.length === 1}>Remove</button></div><div className="market-fields"><input value={m.region || ''} onChange={(e) => patch(index,{ region:e.target.value })} placeholder={country?.region_label || 'Region'} /><input value={m.city || ''} onChange={(e) => patch(index,{ city:e.target.value })} placeholder="City (optional)" /><select value={m.marketType || 'ANY'} onChange={(e) => patch(index,{ marketType:e.target.value })}><option value="ANY">Any work model</option><option value="ONSITE">On-site</option><option value="HYBRID">Hybrid</option><option value="REMOTE">Remote</option></select><select value={m.timezoneId || ''} onChange={(e) => patch(index,{ timezoneId:e.target.value })}><option value="">Timezone (optional)</option>{zones.map((z) => <option key={z.timezone_id} value={z.timezone_id}>{z.display_name} · {z.timezone_id}</option>)}</select></div><label className="primary-toggle"><input type="radio" name="primary-market" checked={m.priority === 'PRIMARY'} onChange={() => onChange(value.map((row,i) => ({ ...row, priority: i === index ? 'PRIMARY' : 'SECONDARY', preferred: i === index })))} /> Primary recruiting market</label></article>; })}</div></div>;
}

function PipelineEditor({ pipeline, onSaved }) {
  const [draft, setDraft] = useState(() => ({ ...pipeline, stages: cleanArray(pipeline.stages).map((s) => ({ ...s })) }));
  const [state, setState] = useState('idle');
  function move(index, delta) { const stages=[...draft.stages]; const to=Math.max(0,Math.min(stages.length-1,index+delta)); if(to===index)return; const [item]=stages.splice(index,1); stages.splice(to,0,item); setDraft({ ...draft, stages: stages.map((s,i) => ({ ...s, sortOrder:(i+1)*10 })) }); }
  function patchStage(index, patch) { setDraft({ ...draft, stages:draft.stages.map((s,i) => i===index ? { ...s,...patch } : s) }); }
  async function save() { setState('saving'); const res=await fetch('/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'pipeline',payload:{ id:draft.id,name:draft.name,pipelineKind:draft.pipeline_kind,recruitmentType:draft.recruitment_type,isDefault:draft.is_default,stages:draft.stages.map((s,i)=>({code:s.code,name:s.name,category:s.stage_category || s.category,semantic:s.status_semantic || s.semantic,sortOrder:(i+1)*10,requiredFields:s.required_fields || [],rejectionReasons:s.rejection_reasons || [],transitionRules:s.transition_rules || {}})) }})}); const data=await res.json(); setState(res.ok?'saved':'error'); if(res.ok) onSaved?.(data); }
  return <article className="pipeline-editor"><div className="pipeline-editor-head"><div><input value={draft.name} onChange={(e)=>setDraft({ ...draft,name:e.target.value })} aria-label="Pipeline name" /><span>{draft.pipeline_kind === 'BUSINESS_DEVELOPMENT' ? 'Business Development' : draft.recruitment_type || 'Recruitment'}</span></div><button type="button" onClick={save}>{state==='saving'?'Saving…':'Save pipeline'}</button></div><div className="stage-list">{draft.stages.map((s,index)=><div className="stage-row" key={`${s.code}-${index}`} draggable onDragStart={(e)=>e.dataTransfer.setData('text/plain',String(index))} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(from)){const stages=[...draft.stages];const [item]=stages.splice(from,1);stages.splice(index,0,item);setDraft({ ...draft,stages:stages.map((x,i)=>({ ...x,sortOrder:(i+1)*10 }))});}}}><span className="drag-handle" title="Drag to reorder">⋮⋮</span><input value={s.name} onChange={(e)=>patchStage(index,{name:e.target.value})} aria-label={`Stage ${index+1} name`} /><select value={s.stage_category || s.category || 'ACTIVE'} onChange={(e)=>patchStage(index,{stage_category:e.target.value})}><option value="ACTIVE">Active</option><option value="TERMINAL">Terminal</option></select><div className="stage-move"><button type="button" onClick={()=>move(index,-1)} disabled={index===0}>↑</button><button type="button" onClick={()=>move(index,1)} disabled={index===draft.stages.length-1}>↓</button><button type="button" onClick={()=>setDraft({ ...draft,stages:draft.stages.filter((_,i)=>i!==index) })}>×</button></div></div>)}</div><button type="button" className="add-stage" onClick={()=>setDraft({ ...draft,stages:[...draft.stages,{code:`CUSTOM_${Date.now()}`,name:'New stage',stage_category:'ACTIVE',status_semantic:'NEUTRAL'}] })}>＋ Add stage</button>{state==='saved'?<small className="save-good">Saved</small>:state==='error'?<small className="save-error">Could not save</small>:null}</article>;
}

export default function OnboardingWizard({ user, globalContext, onboarding, initialSection='profile', editMode=false }) {
  const router = useRouter();
  const countries = cleanArray(globalContext.countries);
  const timezones = cleanArray(globalContext.timezones);
  const languages = cleanArray(globalContext.languages);
  const taxonomies = cleanArray(onboarding.taxonomies);
  const [mode,setMode] = useState(onboarding.progress?.setup_mode || onboarding.profile?.setup_mode || 'QUICK');
  const allSteps = useMemo(() => mode === 'ADVANCED' ? ['profile','markets','industries','icp','specialization','candidate','pipelines','team','import','review'] : ['profile','markets','industries','icp','specialization','pipelines','team','import','review'], [mode]);
  const [current,setCurrent] = useState(allSteps.includes(initialSection) ? initialSection : 'profile');
  const [drafts,setDrafts] = useState(() => initialDrafts(user,globalContext,onboarding));
  const [saveState,setSaveState] = useState('saved');
  const [error,setError] = useState('');
  const [pipelines,setPipelines] = useState(cleanArray(onboarding.pipelines));
  const firstRun = useRef(true);
  const currentIndex = allSteps.indexOf(current);
  const completed = new Set(cleanArray(onboarding.progress?.completed_steps));

  useEffect(() => { if (!allSteps.includes(current)) setCurrent(allSteps[0]); }, [allSteps,current]);
  const currentSerialized = JSON.stringify(drafts[current] || {});
  useEffect(() => {
    if (firstRun.current) { firstRun.current=false; return; }
    if (current === 'pipelines' || current === 'review') return;
    setSaveState('unsaved');
    const timer=setTimeout(async()=>{
      setSaveState('saving');
      try { const res=await fetch('/api/onboarding',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({section:current,payload:{...drafts[current],setupMode:mode},markComplete:false})}); setSaveState(res.ok?'saved':'error'); }
      catch { setSaveState('error'); }
    },850);
    return()=>clearTimeout(timer);
  },[current,currentSerialized,mode]);

  function patch(section, next) { setDrafts((d)=>({ ...d,[section]:{ ...d[section],...next } })); }
  async function saveSection(markComplete=true) {
    setError('');setSaveState('saving');
    const payload=current==='pipelines'?{ready:true,setupMode:mode}:{...drafts[current],setupMode:mode};
    const res=await fetch('/api/onboarding',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({section:current,payload,markComplete})});
    const data=await res.json();
    if(!res.ok){setError(data.error||'Could not save this step.');setSaveState('error');return false;}
    setSaveState('saved');return true;
  }
  async function next() { if(await saveSection(true)){ const nextStep=allSteps[Math.min(allSteps.length-1,currentIndex+1)];setCurrent(nextStep);window.scrollTo({top:0,behavior:'smooth'}); } }
  function back() { setCurrent(allSteps[Math.max(0,currentIndex-1)]);window.scrollTo({top:0,behavior:'smooth'}); }
  async function skip() { await saveSection(false); setCurrent(allSteps[Math.min(allSteps.length-1,currentIndex+1)]); }
  function applyPreset(preset) {
    const p=preset.payload||{};
    patch('profile',{businessModels:p.businessModels||drafts.profile.businessModels});
    if(p.markets){const rows=p.markets.map((code,i)=>{const c=countries.find((x)=>x.country_code===code);const z=timezones.find((x)=>x.country_code===code&&x.is_default)||timezones.find((x)=>x.country_code===code);return{countryCode:code,region:'',city:'',marketType:'ANY',priority:i===0?'PRIMARY':'SECONDARY',timezoneId:z?.timezone_id||c?.default_timezone||'',preferred:i===0,targetKind:'RECRUITING'};});patch('markets',{markets:rows});}
    if(p.industries) patch('industries',{industries:p.industries});
    if(p.companySizes) patch('icp',{companySizes:p.companySizes});
    patch('specialization',{jobFunctions:p.jobFunctions||drafts.specialization.jobFunctions,seniority:p.seniority||drafts.specialization.seniority});
  }

  const domainOptions=(domain)=>taxonomies.filter((t)=>t.domain===domain).map((t)=>({value:t.code,label:t.label,code:t.code,level:t.level||0}));
  const selectedMarketNames=drafts.markets.markets.map((m)=>countries.find((c)=>c.country_code===m.countryCode)?.country_name||m.countryCode);
  const selectedIndustryNames=drafts.industries.industries.map((code)=>taxonomies.find((t)=>t.code===code)?.label||code);
  const selectedFunctions=drafts.specialization.jobFunctions.map((code)=>taxonomies.find((t)=>t.code===code)?.label||code);

  async function finish() {
    setError('');
    await saveSection(true);
    const res=await fetch('/api/onboarding',{method:'POST'});const data=await res.json();
    if(!res.ok){setError(data.missing?.length?`Complete: ${data.missing.join(', ')}`:(data.error||'Setup is incomplete.'));return;}
    router.push('/dashboard?setup=complete');router.refresh();
  }

  let content=null;
  if(current==='profile') content=<><div className="setup-mode"><button type="button" className={mode==='QUICK'?'active':''} onClick={()=>{setMode('QUICK');patch('profile',{setupMode:'QUICK'});}}><b>Quick Setup</b><span>Smart defaults · about 5–10 minutes</span></button><button type="button" className={mode==='ADVANCED'?'active':''} onClick={()=>{setMode('ADVANCED');patch('profile',{setupMode:'ADVANCED'});}}><b>Advanced Setup</b><span>More control over talent, fields and workflows</span></button></div><div className="preset-strip"><div><b>Start from a preset</b><span>Everything stays editable.</span></div><div className="preset-scroll">{cleanArray(onboarding.presets).map((p)=><button type="button" key={p.preset_code} onClick={()=>applyPreset(p)}><b>{p.name}</b><small>{p.description}</small></button>)}</div></div><div className="form-grid two"><TextInput label="Workspace name" name="workspaceName" value={drafts.profile.workspaceName} onChange={(e)=>patch('profile',{workspaceName:e.target.value})} required/><TextInput label="Business name" name="businessName" value={drafts.profile.businessName} onChange={(e)=>patch('profile',{businessName:e.target.value})}/><TextInput label="Website" name="website" type="url" value={drafts.profile.website} onChange={(e)=>patch('profile',{website:e.target.value})} placeholder="https://"/><CountrySelect label="Primary country" name="countryCode" countries={countries} value={drafts.profile.countryCode} onChange={(e)=>{const c=countries.find((x)=>x.country_code===e.target.value);const z=timezones.find((x)=>x.country_code===e.target.value&&x.is_default)||timezones.find((x)=>x.country_code===e.target.value);patch('profile',{countryCode:e.target.value,locale:c?.default_locale||drafts.profile.locale,currencyCode:c?.default_currency||drafts.profile.currencyCode,timezoneId:z?.timezone_id||c?.default_timezone||drafts.profile.timezoneId,languageCode:c?.default_language_code||drafts.profile.languageCode});}}/><TimezoneSelect label="Default timezone" name="timezoneId" timezones={timezones.filter((z)=>z.country_code===drafts.profile.countryCode)} value={drafts.profile.timezoneId} onChange={(e)=>patch('profile',{timezoneId:e.target.value})}/><SelectInput label="Default language" name="languageCode" value={drafts.profile.languageCode} onChange={(e)=>patch('profile',{languageCode:e.target.value})} options={languages.map((l)=>({value:l.language_code,label:`${l.english_name} · ${l.native_name}`}))}/><TextInput label="Locale (BCP-47)" name="locale" value={drafts.profile.locale} onChange={(e)=>patch('profile',{locale:e.target.value})}/><TextInput label="Currency (ISO)" name="currencyCode" value={drafts.profile.currencyCode} onChange={(e)=>patch('profile',{currencyCode:e.target.value.toUpperCase()})}/><TextInput label="Team size" name="teamSize" type="number" min="1" value={drafts.profile.teamSize} onChange={(e)=>patch('profile',{teamSize:e.target.value})}/><TextInput label="Recruiter count" name="recruiterCount" type="number" min="0" value={drafts.profile.recruiterCount} onChange={(e)=>patch('profile',{recruiterCount:e.target.value})}/></div><SearchMultiSelect label="Business model" options={businessModelOptions} value={drafts.profile.businessModels} onChange={(businessModels)=>patch('profile',{businessModels})} placeholder="Search recruitment model"/></>;
  if(current==='markets') content=<><div className="section-note"><b>Multi-country by design</b><span>US, Canada and Australia keep their own IANA timezone choices. Nothing here uses fixed UTC offsets.</span></div><MarketSelector countries={countries} timezones={timezones} value={drafts.markets.markets} onChange={(markets)=>patch('markets',{markets})}/></>;
  if(current==='industries') content=<><SearchMultiSelect label="Industry → sub-industry → specialization" options={domainOptions('INDUSTRY')} value={drafts.industries.industries} onChange={(industries)=>patch('industries',{industries})} placeholder="Search SaaS, healthcare, fintech…" hierarchy/><div className="inline-action"><Link href="/settings?focus=industries">＋ Add a custom industry in Configuration Center</Link></div></>;
  if(current==='icp') content=<><SearchMultiSelect label="Target company size" options={domainOptions('COMPANY_SIZE')} value={drafts.icp.companySizes} onChange={(companySizes)=>patch('icp',{companySizes})}/><SearchMultiSelect label="Company type" options={domainOptions('COMPANY_TYPE')} value={drafts.icp.companyTypes} onChange={(companyTypes)=>patch('icp',{companyTypes})}/><SearchMultiSelect label="Funding stage" options={domainOptions('FUNDING_STAGE')} value={drafts.icp.fundingStages} onChange={(fundingStages)=>patch('icp',{fundingStages})}/><SearchMultiSelect label="Target industries" options={domainOptions('INDUSTRY')} value={drafts.icp.industries} onChange={(industries)=>patch('icp',{industries})} hierarchy/><div className="form-grid two"><SelectInput label="Employee growth" name="employeeGrowth" value={drafts.icp.employeeGrowth} onChange={(e)=>patch('icp',{employeeGrowth:e.target.value})} options={['ANY','GROWING','FAST_GROWING','STABLE'].map((v)=>({value:v,label:v.replaceAll('_',' ')}))}/><SelectInput label="Hiring volume" name="hiringVolume" value={drafts.icp.hiringVolume} onChange={(e)=>patch('icp',{hiringVolume:e.target.value})} options={['ANY','LOW','MEDIUM','HIGH','VERY_HIGH'].map((v)=>({value:v,label:v.replaceAll('_',' ')}))}/><SelectInput label="Work model preference" name="remotePreference" value={drafts.icp.remotePreference} onChange={(e)=>patch('icp',{remotePreference:e.target.value})} options={['ANY','REMOTE_FIRST','HYBRID','OFFICE_FIRST'].map((v)=>({value:v,label:v.replaceAll('_',' ')}))}/><SelectInput label="Company scope" name="companyScope" value={drafts.icp.companyScope} onChange={(e)=>patch('icp',{companyScope:e.target.value})} options={['ANY','LOCAL','MULTINATIONAL'].map((v)=>({value:v,label:v}))}/></div><TagsInput label="Revenue bands" name="revenueBands" value={drafts.icp.revenueBands} onChange={(revenueBands)=>patch('icp',{revenueBands})} placeholder="e.g. $10M–$50M"/></>;
  if(current==='specialization'||current==='candidate'){const key=current;const d=drafts[key];content=<><SearchMultiSelect label="Job functions" options={domainOptions('JOB_FUNCTION')} value={d.jobFunctions} onChange={(jobFunctions)=>patch(key,{jobFunctions})}/><SearchMultiSelect label="Seniority" options={domainOptions('SENIORITY')} value={d.seniority} onChange={(seniority)=>patch(key,{seniority})}/><SearchMultiSelect label="Employment types" options={domainOptions('EMPLOYMENT_TYPE')} value={d.employmentTypes} onChange={(employmentTypes)=>patch(key,{employmentTypes})}/><SearchMultiSelect label="Industries" options={domainOptions('INDUSTRY')} value={d.industries} onChange={(industries)=>patch(key,{industries})} hierarchy/><TagsInput label="Major skills" name={`${key}-skills`} value={d.skills} onChange={(skills)=>patch(key,{skills})}/><TagsInput label="Roles / titles" name={`${key}-roles`} value={d.roles} onChange={(roles)=>patch(key,{roles})}/><TagsInput label="Languages" name={`${key}-languages`} value={d.languages} onChange={(languages)=>patch(key,{languages})}/><SearchMultiSelect label={key==='candidate'?'Candidate countries':'Recruiting countries'} options={countries.map((c)=>({value:c.country_code,label:c.country_name}))} value={d.countries} onChange={(countriesNext)=>patch(key,{countries:countriesNext})}/><SalaryRangeInput currency={d.currencyCode} values={{min:d.salaryMin,max:d.salaryMax}} onChange={(v)=>patch(key,{salaryMin:v.min,salaryMax:v.max})}/><SearchMultiSelect label="Availability" options={['REMOTE','HYBRID','ONSITE'].map((v)=>({value:v,label:v[0]+v.slice(1).toLowerCase()}))} value={d.workplace} onChange={(workplace)=>patch(key,{workplace})}/>{key==='candidate'?<div className="form-grid two"><TextInput label="Notice period min (days)" name="noticeDaysMin" type="number" min="0" value={d.noticeDaysMin} onChange={(e)=>patch(key,{noticeDaysMin:e.target.value})}/><TextInput label="Notice period max (days)" name="noticeDaysMax" type="number" min="0" value={d.noticeDaysMax} onChange={(e)=>patch(key,{noticeDaysMax:e.target.value})}/></div>:null}</>}
  if(current==='pipelines') content=<><div className="section-note"><b>Data-driven workflows</b><span>Rename, reorder or add stages. Future ATS logic reads the pipeline configuration instead of assuming fixed stage names.</span></div><div className="pipeline-grid">{pipelines.map((p)=><PipelineEditor key={p.id} pipeline={p} onSaved={()=>setSaveState('saved')}/>)}</div></>;
  if(current==='team') content=<><div className="section-note"><b>RBAC stays separate from business role</b><span>Owner/Admin authorization is preserved. Recruitment Manager, Sourcer, BD and Account Manager are operating profiles, not security shortcuts.</span></div><TagsInput label="Departments" name="departments" value={drafts.team.departments} onChange={(departments)=>patch('team',{departments})}/><TagsInput label="Teams" name="teams" value={drafts.team.teams.map((t)=>t.name)} onChange={(names)=>patch('team',{teams:names.map((name)=>({name,department:''}))})}/><TagsInput label="Teammate emails to configure" name="invites" value={drafts.team.invites.map((i)=>i.email)} onChange={(emails)=>patch('team',{invites:emails.map((email)=>({email,rbacRole:'RECRUITER',businessRole:'RECRUITER'}))})}/><small className="quiet-copy">Step 3 stores invite configuration safely. Email invitation delivery remains a later team-provisioning action.</small></>;
  if(current==='import') content=<div className="import-step-card"><div><span className="page-kicker">Optional</span><h3>Bring a clean starter dataset</h3><p>Companies, clients, contacts and candidates use staged validation, duplicate detection and an explicit commit.</p></div><Link className="primary-action" href="/import?return=/onboarding?section=import">Open CSV Import</Link><span>Up to 1,000 rows per Step‑3 batch. Full ATS migration comes later.</span></div>;
  if(current==='review') content=<><div className="review-hero"><span className="page-kicker">Workspace blueprint</span><h3>{drafts.profile.workspaceName}</h3><p>{drafts.profile.businessName || 'Recruitment workspace'} · {mode === 'QUICK' ? 'Quick Setup' : 'Advanced Setup'}</p></div><div className="review-grid"><article><span>Markets</span><b>{selectedMarketNames.join(' · ') || 'Not selected'}</b></article><article><span>Specialization</span><b>{selectedFunctions.slice(0,5).join(' · ') || 'Not selected'}</b></article><article><span>Industries</span><b>{selectedIndustryNames.slice(0,5).join(' · ') || 'Not selected'}</b></article><article><span>Target accounts</span><b>{drafts.icp.companySizes.map((code)=>taxonomies.find((t)=>t.code===code)?.label||code).join(' · ') || 'Any size'}</b></article></div><div className="completion-list">{['profile','markets','industries','icp','specialization','pipelines','candidate','team','import'].map((key)=><button type="button" key={key} onClick={()=>setCurrent(key)} disabled={!allSteps.includes(key)}><span>{requiredSteps.has(key)?'Required':'Optional'}</span><b>{stepMeta[key]?.[0]}</b><small>{completed.has(key)?'Previously completed':'Review or configure'}</small></button>)}</div>{mode==='ADVANCED'?<div className="advanced-links"><Link href="/settings?focus=custom-fields">Custom Fields</Link><Link href="/settings?focus=territories">Territories</Link><Link href="/settings?focus=views">Custom Views</Link></div>:null}</>;

  return <main className="setup-shell"><header className="setup-topbar"><Brand compact/><div className="setup-top-actions"><span className={`save-state ${saveState}`}>{saveState==='saving'?'Saving…':saveState==='unsaved'?'Unsaved changes':saveState==='error'?'Save issue':'Saved'}</span>{editMode?<Link href="/settings">Configuration Center</Link>:<button type="button" onClick={()=>router.push('/dashboard')}>Resume later</button>}</div></header><div className="setup-layout"><aside className="setup-progress"><div className="setup-progress-head"><span>{editMode?'Edit configuration':'Workspace setup'}</span><b>{onboarding.progress?.progress_percent || 0}%</b></div><div className="progress-track"><i style={{width:`${onboarding.progress?.progress_percent || (currentIndex/allSteps.length*100)}%`}}/></div><nav>{allSteps.map((key,index)=><button type="button" key={key} onClick={()=>setCurrent(key)} className={current===key?'active':''}><span>{completed.has(key)?'✓':String(index+1).padStart(2,'0')}</span><div><b>{stepMeta[key][0]}</b><small>{requiredSteps.has(key)?'Required':'Optional'}</small></div></button>)}</nav></aside><section className="setup-main"><div className="mobile-step-strip">{allSteps.map((key,index)=><button key={key} type="button" className={current===key?'active':''} onClick={()=>setCurrent(key)}>{index+1}</button>)}</div><div className="setup-heading"><div><span className="page-kicker">{requiredSteps.has(current)?'Required setup':'Optional setup'}</span><h1>{stepMeta[current][0]}</h1><p>{stepMeta[current][1]}</p></div><span>{currentIndex+1} / {allSteps.length}</span></div>{error?<div className="setup-error" role="alert">{error}</div>:null}<div className="setup-card">{content}</div><footer className="setup-footer"><button type="button" onClick={back} disabled={currentIndex===0}>← Back</button><div>{!requiredSteps.has(current)&&current!=='review'?<button type="button" className="text-action" onClick={skip}>Skip for now</button>:null}{current==='review'?<button type="button" className="primary-action" onClick={finish}>{editMode?'Save & return to workspace':'Enter my recruiter workspace'}</button>:<button type="button" className="primary-action" onClick={next}>Save & continue →</button>}</div></footer></section></div></main>;
}
