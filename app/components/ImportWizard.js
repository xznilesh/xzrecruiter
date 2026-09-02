'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { mapCsvRows, parseCsv, suggestMapping, targetFields } from '@/lib/csv';

const labels = { COMPANY:'Companies', CLIENT:'Clients', CONTACT:'Contacts', CANDIDATE:'Candidates' };

export default function ImportWizard({ returnTo='/settings' }) {
  const [entityType,setEntityType]=useState('CANDIDATE');
  const [file,setFile]=useState(null);
  const [parsed,setParsed]=useState({headers:[],rows:[],truncated:false});
  const [mapping,setMapping]=useState({});
  const [stageResult,setStageResult]=useState(null);
  const [commitResult,setCommitResult]=useState(null);
  const [state,setState]=useState('idle');
  const [error,setError]=useState('');
  const mappedPreview=useMemo(()=>mapCsvRows(parsed.rows.slice(0,5),mapping),[parsed.rows,mapping]);

  async function chooseFile(nextFile) {
    setError('');setStageResult(null);setCommitResult(null);setFile(nextFile||null);
    if(!nextFile){setParsed({headers:[],rows:[],truncated:false});return;}
    if(nextFile.size>2*1024*1024){setError('Use a CSV up to 2 MB for Step 3.');return;}
    const result=parseCsv(await nextFile.text(),{maxRows:1000});
    if(!result.headers.length){setError('No CSV rows were found.');return;}
    setParsed(result);setMapping(suggestMapping(result.headers,entityType));
  }
  function changeEntity(next){setEntityType(next);setMapping(suggestMapping(parsed.headers,next));setStageResult(null);setCommitResult(null);}
  async function validate() {
    if(!file||!parsed.rows.length){setError('Choose a CSV first.');return;}
    setState('validating');setError('');
    const rows=mapCsvRows(parsed.rows,mapping);
    const fingerprint=`${entityType}:${file.name}:${file.size}:${file.lastModified}:${parsed.rows.length}`;
    try{
      const res=await fetch('/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'stage',entityType,filename:file.name,idempotencyKey:fingerprint,headers:parsed.headers,mapping,rows})});
      const data=await res.json();if(!res.ok)throw new Error(data.error||'Validation failed.');setStageResult(data);setState('validated');
    }catch(e){setError(e.message);setState('error');}
  }
  async function commit() {
    if(!stageResult?.batch_id)return;setState('importing');setError('');
    try{const res=await fetch('/api/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'commit',batchId:stageResult.batch_id})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Import failed.');setCommitResult(data);setState('done');}
    catch(e){setError(e.message);setState('error');}
  }

  return <div className="import-wizard"><div className="import-flow"><span className={file?'done':'active'}>1 Upload</span><span className={parsed.headers.length?'done':''}>2 Map</span><span className={stageResult?'done':''}>3 Validate</span><span className={commitResult?'done':''}>4 Import</span><span className={commitResult?'active':''}>5 Report</span></div>
    {error?<div className="setup-error" role="alert">{error}</div>:null}
    <section className="import-card"><div className="form-grid two"><label className="form-control"><span>Import type</span><select value={entityType} onChange={(e)=>changeEntity(e.target.value)}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="file-drop"><input type="file" accept=".csv,text/csv" onChange={(e)=>chooseFile(e.target.files?.[0])}/><b>{file?file.name:'Choose CSV file'}</b><span>{file?`${parsed.rows.length} parsed rows`:'CSV · max 2 MB · up to 1,000 rows'}</span></label></div>{parsed.truncated?<p className="import-warning">Only the first 1,000 rows are included in this Step‑3 batch.</p>:null}</section>
    {parsed.headers.length>0?<section className="import-card"><div className="panel-title-row"><div><h2>Map columns</h2><p>Detected columns are never silently discarded. Leave a target unmapped only when it is genuinely optional.</p></div><span className="panel-badge">{parsed.headers.length} detected</span></div><div className="mapping-grid">{targetFields(entityType).map((target)=><label key={target}><span>{target.replaceAll('_',' ')}</span><select value={mapping[target]||''} onChange={(e)=>setMapping({...mapping,[target]:e.target.value})}><option value="">Not mapped</option>{parsed.headers.map((h)=><option key={h} value={h}>{h}</option>)}</select></label>)}</div><div className="table-scroll import-preview"><table><thead><tr>{Object.keys(mapping).filter((k)=>mapping[k]).map((k)=><th key={k}>{k}</th>)}</tr></thead><tbody>{mappedPreview.map((row,i)=><tr key={i}>{Object.keys(mapping).filter((k)=>mapping[k]).map((k)=><td key={k}>{String(row.mapped[k]||'—')}</td>)}</tr>)}</tbody></table></div><button className="primary-action" type="button" onClick={validate} disabled={state==='validating'}>{state==='validating'?'Validating…':'Validate & stage rows'}</button></section>:null}
    {stageResult?<section className="import-card"><h2>Validation report</h2><div className="import-stats"><div><span>Rows</span><b>{stageResult.row_count}</b></div><div><span>Valid</span><b>{stageResult.valid_rows}</b></div><div><span>Invalid</span><b>{stageResult.invalid_rows}</b></div><div><span>Duplicates</span><b>{stageResult.duplicate_rows}</b></div></div><p>No row is imported yet. Invalid and duplicate rows stay out of production records.</p><button className="primary-action" type="button" onClick={commit} disabled={!stageResult.valid_rows||state==='importing'}>{state==='importing'?'Importing…':`Import ${stageResult.valid_rows} valid rows`}</button></section>:null}
    {commitResult?<section className="import-card success-report"><span className="auth-status-icon">✓</span><div><h2>Import report ready</h2><p>{commitResult.imported} records imported. {commitResult.failed} failed rows remain reportable/retryable.</p></div><Link className="primary-action" href={returnTo}>Continue</Link></section>:null}
  </div>;
}
