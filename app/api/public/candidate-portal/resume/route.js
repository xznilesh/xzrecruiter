import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';
import { extractResumeText, parseResumeText } from '@/lib/resume-parser';
import { storageConfigured, uploadPrivateObject } from '@/lib/server-storage';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const ALLOWED=new Set(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']);
const MAX_BYTES=8*1024*1024;
function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin}

async function finalize(token,prepared,parsed,error=null){
 return rpc('xzrecruiter_candidate_portal_finalize_parse',{
  p_portal_token:token,
  p_parse_run_id:prepared.parse_run_id,
  p_extracted_data:parsed?.extractedData||{},
  p_field_confidence:parsed?.fieldConfidence||{},
  p_field_evidence:parsed?.fieldEvidence||{},
  p_error:error
 });
}

export async function POST(req){
 if(!sameOrigin(req))return NextResponse.json({error:'invalid_origin'},{status:403});
 if(!storageConfigured())return NextResponse.json({error:'storage_not_configured'},{status:503});
 let form;try{form=await req.formData()}catch{return NextResponse.json({error:'invalid_multipart'},{status:400})}
 const token=String(form.get('token')||'');const file=form.get('file');
 if(token.length<24)return NextResponse.json({error:'invalid_token'},{status:400});
 if(!(file instanceof File))return NextResponse.json({error:'file_required'},{status:400});
 if(!ALLOWED.has(file.type))return NextResponse.json({error:'unsupported_file_type'},{status:415});
 if(!file.size||file.size>MAX_BYTES)return NextResponse.json({error:'invalid_file_size'},{status:413});
 const bytes=Buffer.from(await file.arrayBuffer());const checksum=createHash('sha256').update(bytes).digest('hex');
 let prepared;
 try{
  prepared=await rpc('xzrecruiter_candidate_portal_prepare_document',{p_portal_token:token,p_filename:file.name||'resume',p_mime_type:file.type,p_size_bytes:file.size,p_checksum:checksum});
 }catch(error){console.error('candidate_portal_resume_prepare_failed',error?.message||'');return NextResponse.json({error:'portal_temporarily_unavailable'},{status:503})}
 if(!prepared?.ok)return NextResponse.json(prepared||{error:'resume_prepare_failed'},{status:prepared?.error==='invalid_or_expired'?401:400});
 try{await uploadPrivateObject(prepared.storage_path,bytes,file.type)}catch(error){
  console.error('candidate_portal_resume_storage_failed',error?.message||'');
  await finalize(token,prepared,null,'storage_upload_failed').catch(()=>null);
  return NextResponse.json({error:'storage_upload_failed'},{status:503});
 }
 try{
  const text=await extractResumeText(bytes,file.type,file.name);if(!text||text.length<20)throw new Error('resume_text_empty');
  const parsed=parseResumeText(text);const result=await finalize(token,prepared,parsed,null);
  if(!result?.ok)return NextResponse.json(result||{error:'parse_finalize_failed'},{status:400});
  return NextResponse.json({ok:true,documentId:prepared.document_id,parseRunId:prepared.parse_run_id,versionNumber:prepared.version_number,reviewRequired:true});
 }catch(error){
  console.error('candidate_portal_resume_parse_failed',error?.message||'');
  await finalize(token,prepared,null,error?.message||'parse_failed').catch(()=>null);
  return NextResponse.json({error:'resume_parse_failed'},{status:422});
 }
}
