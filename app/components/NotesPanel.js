'use client';

import { useEffect, useState } from 'react';

async function ats(action,payload){const res=await fetch('/api/ats',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,payload})});const data=await res.json().catch(()=>({error:'invalid_response'}));if(!res.ok)throw new Error(data?.error||'request_failed');return data}

export default function NotesPanel({entityType,entityId,title='Notes'}){
 const[notes,setNotes]=useState([]);const[text,setText]=useState('');const[state,setState]=useState('loading');const[currentUser,setCurrentUser]=useState('');const[role,setRole]=useState('');
 async function load(){if(!entityId)return;setState('loading');try{const data=await ats('noteContext',{entityType,entityId});setNotes(data.notes||[]);setCurrentUser(data.current_user_id||'');setRole(data.role||'');setState('ready')}catch(e){setState(e.message||'error')}}
 useEffect(()=>{load()},[entityType,entityId]);
 async function save(){if(!text.trim())return;setState('saving');try{await ats('saveNote',{entityType,entityId,note:text.trim()});setText('');await load()}catch(e){setState(e.message||'error')}}
 async function archive(note){if(!confirm('Archive this note? The audit event remains preserved.'))return;setState('saving');try{await ats('archiveNote',{noteId:note.id});await load()}catch(e){setState(e.message||'error')}}
 return <section className="closeout-section notes-panel"><div className="closeout-title"><div><b>{title}</b><small>Workspace notes · author and timestamp preserved · archive-safe</small></div><span>{notes.length}</span></div><label className="form-control"><span>Add note</span><textarea rows="3" maxLength="10000" value={text} onChange={(e)=>setText(e.target.value)} placeholder="Add recruiter context, qualification evidence, client feedback or follow-up details…"/></label><div className="notes-actions"><small>{text.length}/10000</small><button className="primary-action" disabled={!text.trim()||state==='saving'} onClick={save}>{state==='saving'?'Saving…':'Add note'}</button></div>{notes.length?<div className="notes-list">{notes.map((n)=><article key={n.id}><div><b>{n.author_name||'Team member'}</b><small>{new Date(n.created_at).toLocaleString()}</small></div><p>{n.note}</p>{n.author_user_id===currentUser||['OWNER','ADMIN'].includes(role)?<button className="ghost-action" onClick={()=>archive(n)}>Archive</button>:null}</article>)}</div>:state==='ready'?<small>No notes yet.</small>:null}{!['ready','loading','saving'].includes(state)?<small className="save-error">Notes error: {state}</small>:null}</section>
}
