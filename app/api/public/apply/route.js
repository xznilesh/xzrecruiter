import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';
import { extractResumeText, parseResumeText } from '@/lib/resume-parser';
import { storageConfigured, uploadPrivateObject } from '@/lib/server-storage';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const ALLOWED=new Set(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']);
const MAX_BYTES=8*1024*1024;

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin;}
function statusFor(error){if(error==='not_found')return 404;if(error==='already_applied')return 409;if(error==='consent_required')return 422;if(error==='invalid_country'||error==='invalid_timezone'||error==='name_email_required')return 400;return 400;}
function safeResponse(result,extra={}){return {ok:true,applicationId:result.application_id,...extra};}

async function parseInput(req){
 const type=req.headers.get('content-type')||'';
 if(type.includes('multipart/form-data')){
   const form=await req.formData();
   const slug=String(form.get('slug')||'').trim();
   const raw=String(form.get('payload')||'{}');
   let payload;try{payload=JSON.parse(raw)}catch{throw new Error('invalid_payload')}
   const file=form.get('file');
   return {slug,payload,file:file instanceof File?file:null};
 }
 const body=await req.json();
 return {slug:String(body?.slug||'').trim(),payload:body?.payload||{},file:null};
}

export async function POST(req){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin.'},{status:403});
 let input;try{input=await parseInput(req)}catch(error){return NextResponse.json({error:error?.message==='invalid_payload'?'Invalid application details.':'Invalid request.'},{status:400});}
 const {slug,file}=input;const payload={...(input.payload||{})};
 if(!slug)return NextResponse.json({error:'Missing job.'},{status:400});
 if(payload.consent!==true)return NextResponse.json({error:'consent_required'},{status:422});
 if(file){
   if(!ALLOWED.has(file.type))return NextResponse.json({error:'unsupported_file_type'},{status:415});
   if(!file.size||file.size>MAX_BYTES)return NextResponse.json({error:'invalid_file_size'},{status:413});
   if(!storageConfigured())return NextResponse.json({error:'resume_storage_not_configured'},{status:503});
   payload.hasResumeFile=true;
 }

 let result;
 try{result=await rpc('xzrecruiter_public_apply',{p_slug:slug,p_application:payload});}
 catch(error){console.error('public_apply_failed',error?.message||'');return NextResponse.json({error:'Application service unavailable.'},{status:503});}
 if(!result?.ok)return NextResponse.json(result||{error:'application_failed'},{status:statusFor(result?.error)});
 if(!file)return NextResponse.json(safeResponse(result,{resumeUploaded:false}),{status:201});

 const uploadToken=String(result.resume_upload_token||'');
 if(uploadToken.length<32){
   console.error('public_resume_token_missing',result.application_id||'');
   return NextResponse.json(safeResponse(result,{resumeUploaded:false,warning:'resume_token_unavailable'}),{status:201});
 }

 const bytes=Buffer.from(await file.arrayBuffer());
 const checksum=createHash('sha256').update(bytes).digest('hex');
 let prepared;
 try{
   prepared=await rpc('xzrecruiter_public_prepare_application_document',{
     p_upload_token:uploadToken,p_filename:file.name||'resume',p_mime_type:file.type,p_size_bytes:file.size,p_checksum:checksum
   });
 }catch(error){console.error('public_resume_prepare_failed',error?.message||'');return NextResponse.json(safeResponse(result,{resumeUploaded:false,warning:'resume_prepare_failed'}),{status:201});}
 if(!prepared?.ok)return NextResponse.json(safeResponse(result,{resumeUploaded:false,warning:prepared?.error||'resume_prepare_failed'}),{status:201});

 try{
   await uploadPrivateObject(prepared.storage_path,bytes,file.type);
 }catch(error){
   console.error('public_resume_storage_failed',error?.message||'',error?.details||'');
   await rpc('xzrecruiter_public_finalize_application_document',{
     p_upload_token:uploadToken,p_parse_run_id:prepared.parse_run_id,p_extracted_data:{},p_field_confidence:{},p_field_evidence:{},p_error:'storage_upload_failed'
   }).catch(()=>null);
   return NextResponse.json(safeResponse(result,{resumeUploaded:false,warning:'resume_upload_failed'}),{status:201});
 }

 let parseStatus='COMPLETED';
 try{
   const text=await extractResumeText(bytes,file.type,file.name);
   if(!text||text.length<20)throw new Error('resume_text_empty');
   const parsed=parseResumeText(text);
   const finalized=await rpc('xzrecruiter_public_finalize_application_document',{
     p_upload_token:uploadToken,p_parse_run_id:prepared.parse_run_id,p_extracted_data:parsed.extractedData,
     p_field_confidence:parsed.fieldConfidence,p_field_evidence:parsed.fieldEvidence,p_error:null
   });
   if(!finalized?.ok)throw new Error(finalized?.error||'finalize_failed');
 }catch(error){
   parseStatus='FAILED';
   console.error('public_resume_parse_failed',error?.message||'');
   await rpc('xzrecruiter_public_finalize_application_document',{
     p_upload_token:uploadToken,p_parse_run_id:prepared.parse_run_id,p_extracted_data:{},p_field_confidence:{},p_field_evidence:{},p_error:error?.message||'parse_failed'
   }).catch(()=>null);
 }

 return NextResponse.json(safeResponse(result,{resumeUploaded:true,resumeParseStatus:parseStatus}),{status:201});
}
