import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { recruiterAction } from '@/lib/recruiter';
import { candidateIntelligenceAction } from '@/lib/candidate-intelligence';
import { extractResumeText,parseResumeText } from '@/lib/resume-parser';
import { storageConfigured,uploadPrivateObject } from '@/lib/server-storage';
import { validatePrivateUpload } from '@/lib/file-security';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const ALLOWED=new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);
const MAX_BYTES=8*1024*1024;
function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin}
function uuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))}

export async function POST(req){
  if(!sameOrigin(req))return NextResponse.json({error:'invalid_origin'},{status:403});
  if(!storageConfigured())return NextResponse.json({error:'storage_not_configured'},{status:503});
  let form;try{form=await req.formData()}catch{return NextResponse.json({error:'invalid_multipart'},{status:400})}
  const jobId=String(form.get('jobId')||'');const candidateId=String(form.get('candidateId')||'');const file=form.get('file');
  if(!uuid(jobId)||!uuid(candidateId))return NextResponse.json({error:'invalid_target'},{status:400});
  if(!(file instanceof File))return NextResponse.json({error:'file_required'},{status:400});
  if(!ALLOWED.has(file.type))return NextResponse.json({error:'unsupported_file_type'},{status:415});
  if(!file.size||file.size>MAX_BYTES)return NextResponse.json({error:'invalid_file_size'},{status:413});

  const bytes=Buffer.from(await file.arrayBuffer());
  try{validatePrivateUpload({bytes,mimeType:file.type,filename:file.name||'resume',sizeBytes:file.size})}
  catch(error){return NextResponse.json({error:error?.message||'invalid_file'},{status:error?.message==='invalid_file_size'?413:415})}
  const checksum=createHash('sha256').update(bytes).digest('hex');
  const prepared=await recruiterAction('prepareResume',{
    jobId,candidateId,filename:file.name||'resume',mimeType:file.type,sizeBytes:file.size,checksum
  }).catch(()=>null);
  if(!prepared?.ok)return NextResponse.json(prepared||{error:'resume_prepare_failed'},{status:['resume_upload_forbidden','requirement_access_forbidden','candidate_access_forbidden'].includes(prepared?.error)?403:400});
  if(prepared.reused)return NextResponse.json({ok:true,reused:true,documentId:prepared.document_id,parseRunId:prepared.parse_run_id});

  try{
    await uploadPrivateObject(prepared.storage_path,bytes,file.type);
  }catch(error){
    await recruiterAction('finalizeResume',{jobId,parseRunId:prepared.parse_run_id,extractedData:{},fieldConfidence:{},fieldEvidence:{},error:'storage_upload_failed'}).catch(()=>null);
    console.error('recruiter_resume_storage_failed',error?.message||'');
    return NextResponse.json({error:'storage_upload_failed'},{status:503});
  }

  try{
    const text=await extractResumeText(bytes,file.type,file.name);
    if(!text||text.length<20)throw new Error('resume_text_empty');
    const parsed=parseResumeText(text);
    const finalized=await recruiterAction('finalizeResume',{
      jobId,parseRunId:prepared.parse_run_id,extractedData:parsed.extractedData,
      fieldConfidence:parsed.fieldConfidence,fieldEvidence:parsed.fieldEvidence,error:null
    });
    if(!finalized?.ok)return NextResponse.json(finalized,{status:400});
    const textStored=await candidateIntelligenceAction('storeParseText',{
      jobId,parseRunId:prepared.parse_run_id,extractedText:text
    }).catch(()=>null);
    if(!textStored?.ok){
      console.error('candidate_intelligence_parse_text_store_failed',textStored?.error||'unavailable');
      return NextResponse.json({error:'resume_intelligence_text_store_failed'},{status:503});
    }
    return NextResponse.json({ok:true,reused:false,documentId:prepared.document_id,parseRunId:prepared.parse_run_id,versionNumber:prepared.version_number});
  }catch(error){
    await recruiterAction('finalizeResume',{jobId,parseRunId:prepared.parse_run_id,extractedData:{},fieldConfidence:{},fieldEvidence:{},error:error?.message||'parse_failed'}).catch(()=>null);
    console.error('recruiter_resume_parse_failed',error?.message||'');
    return NextResponse.json({error:'resume_parse_failed'},{status:422});
  }
}
