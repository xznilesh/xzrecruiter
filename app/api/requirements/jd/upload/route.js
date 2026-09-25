import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { jdAction } from '@/lib/jd';
import { extractJdDocumentText, JD_ALLOWED_MIME_TYPES, JD_MAX_FILE_BYTES } from '@/lib/jd-document-parser';
import { storageConfigured, uploadPrivateObject } from '@/lib/server-storage';
import { validatePrivateUpload } from '@/lib/file-security';

import { mutationRequestIsTrusted,declaredBodyWithin } from '@/lib/request-security';
export const runtime='nodejs';
export const dynamic='force-dynamic';

function uuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))}

export async function POST(req){
  if(!mutationRequestIsTrusted(req))return NextResponse.json({error:'invalid_request_origin'},{status:403});
  if(!declaredBodyWithin(req,JD_MAX_FILE_BYTES+262144))return NextResponse.json({error:'request_too_large'},{status:413});
  if(!storageConfigured())return NextResponse.json({error:'storage_not_configured'},{status:503});
  let form;
  try{form=await req.formData()}catch{return NextResponse.json({error:'invalid_multipart'},{status:400})}
  const jobId=String(form.get('jobId')||'');
  const file=form.get('file');
  if(!uuid(jobId))return NextResponse.json({error:'invalid_job'},{status:400});
  if(!(file instanceof File))return NextResponse.json({error:'file_required'},{status:400});
  if(!JD_ALLOWED_MIME_TYPES.includes(file.type))return NextResponse.json({error:'unsupported_file_type'},{status:415});
  if(!file.size||file.size>JD_MAX_FILE_BYTES)return NextResponse.json({error:'invalid_file_size'},{status:413});

  const bytes=Buffer.from(await file.arrayBuffer());
  try{validatePrivateUpload({bytes,mimeType:file.type,filename:file.name||'jd-document',sizeBytes:file.size,maxBytes:JD_MAX_FILE_BYTES})}
  catch(error){return NextResponse.json({error:error?.message||'invalid_file'},{status:error?.message==='invalid_file_size'?413:415})}
  const checksum=createHash('sha256').update(bytes).digest('hex');
  const prepared=await jdAction('prepareSource',{
    jobId,sourceType:'UPLOAD',filename:file.name||'jd-document',mimeType:file.type,sizeBytes:file.size,checksum,
  }).catch(()=>null);
  if(!prepared?.ok)return NextResponse.json(prepared||{error:'jd_source_prepare_failed'},{status:prepared?.error==='am_only'?403:400});
  if(prepared.duplicate)return NextResponse.json(prepared);

  try{
    await uploadPrivateObject(prepared.storage_path,bytes,file.type);
  }catch(error){
    await jdAction('finalizeSource',{sourceId:prepared.source_id,error:'storage_upload_failed'}).catch(()=>null);
    console.error('jd_storage_upload_failed',error?.message||'');
    return NextResponse.json({error:'storage_upload_failed'},{status:503});
  }

  try{
    const text=await extractJdDocumentText(bytes,file.type,file.name);
    if(text.length<20)throw new Error('jd_text_too_short');
    const finalized=await jdAction('finalizeSource',{sourceId:prepared.source_id,extractedText:text,error:null});
    if(!finalized?.ok)return NextResponse.json(finalized,{status:400});
    return NextResponse.json({
      ok:true,source_id:prepared.source_id,version_number:prepared.version_number,
      source_status:'READY',filename:file.name,textLength:text.length,
    });
  }catch(error){
    const code=String(error?.message||'jd_parse_failed').slice(0,120);
    await jdAction('finalizeSource',{sourceId:prepared.source_id,error:code}).catch(()=>null);
    console.error('jd_document_parse_failed',code);
    return NextResponse.json({error:'jd_parse_failed'},{status:422});
  }
}
