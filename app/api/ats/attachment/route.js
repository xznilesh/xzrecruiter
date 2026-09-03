import { NextResponse } from 'next/server';
import { atsAction } from '@/lib/ats';
import { createSignedPrivateUrl, storageConfigured, uploadPrivateObject } from '@/lib/server-storage';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const ALLOWED=new Set(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg']);
const MAX_BYTES=8*1024*1024;
function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin}
function uuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}

export async function GET(req){
 if(!storageConfigured())return NextResponse.json({error:'storage_not_configured'},{status:503});
 const attachmentId=String(req.nextUrl.searchParams.get('attachmentId')||'');
 if(attachmentId){
  if(!uuid(attachmentId))return NextResponse.json({error:'invalid_attachment'},{status:400});
  const access=await atsAction('attachmentAccess',{attachmentId}).catch(()=>null);
  if(!access?.ok)return NextResponse.json(access||{error:'attachment_unavailable'},{status:access?.error==='unauthorized'?401:404});
  const signed=await createSignedPrivateUrl(access.storage_path,120).catch(()=>null);
  if(!signed)return NextResponse.json({error:'signed_url_failed'},{status:503});
  return NextResponse.redirect(signed,302);
 }
 const entityType=String(req.nextUrl.searchParams.get('entityType')||'');const entityId=String(req.nextUrl.searchParams.get('entityId')||'');
 if(!uuid(entityId))return NextResponse.json({error:'invalid_entity'},{status:400});
 const result=await atsAction('attachmentContext',{entityType,entityId}).catch(()=>null);
 if(!result?.ok)return NextResponse.json(result||{error:'attachment_context_failed'},{status:result?.error==='unauthorized'?401:400});
 return NextResponse.json(result);
}

export async function POST(req){
 if(!sameOrigin(req))return NextResponse.json({error:'invalid_origin'},{status:403});
 if(!storageConfigured())return NextResponse.json({error:'storage_not_configured'},{status:503});
 let form;try{form=await req.formData()}catch{return NextResponse.json({error:'invalid_multipart'},{status:400})}
 const entityType=String(form.get('entityType')||'');const entityId=String(form.get('entityId')||'');const file=form.get('file');
 if(!uuid(entityId))return NextResponse.json({error:'invalid_entity'},{status:400});
 if(!(file instanceof File))return NextResponse.json({error:'file_required'},{status:400});
 if(!ALLOWED.has(file.type))return NextResponse.json({error:'unsupported_file_type'},{status:415});
 if(!file.size||file.size>MAX_BYTES)return NextResponse.json({error:'invalid_file_size'},{status:413});
 const prepared=await atsAction('prepareAttachment',{entityType,entityId,filename:file.name||'attachment',mimeType:file.type,sizeBytes:file.size}).catch(()=>null);
 if(!prepared?.ok)return NextResponse.json(prepared||{error:'attachment_prepare_failed'},{status:prepared?.error==='forbidden'?403:400});
 const bytes=Buffer.from(await file.arrayBuffer());
 try{await uploadPrivateObject(prepared.storage_path,bytes,file.type)}catch(error){console.error('attachment_storage_failed',error?.message||'');await atsAction('archiveAttachment',{attachmentId:prepared.attachment_id}).catch(()=>null);return NextResponse.json({error:'storage_upload_failed'},{status:503})}
 return NextResponse.json({ok:true,attachmentId:prepared.attachment_id});
}

export async function DELETE(req){
 if(!sameOrigin(req))return NextResponse.json({error:'invalid_origin'},{status:403});
 let body;try{body=await req.json()}catch{return NextResponse.json({error:'invalid_request'},{status:400})}
 const attachmentId=String(body?.attachmentId||'');if(!uuid(attachmentId))return NextResponse.json({error:'invalid_attachment'},{status:400});
 const result=await atsAction('archiveAttachment',{attachmentId}).catch(()=>null);if(!result?.ok)return NextResponse.json(result||{error:'archive_failed'},{status:result?.error==='forbidden'?403:400});return NextResponse.json(result);
}
