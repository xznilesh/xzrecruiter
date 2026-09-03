import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';
import { storageConfigured,uploadPrivateObject } from '@/lib/server-storage';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const MAX_BYTES=8*1024*1024;
const ALLOWED=new Set(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']);
function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin;}

export async function POST(req){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin.'},{status:403});
 let form;try{form=await req.formData();}catch{return NextResponse.json({error:'Invalid request.'},{status:400});}
 const token=String(form.get('token')||'');let payload={};try{payload=JSON.parse(String(form.get('payload')||'{}'));}catch{return NextResponse.json({error:'Invalid candidate payload.'},{status:400});}
 const file=form.get('file');if(!token)return NextResponse.json({error:'Missing portal token.'},{status:400});
 if(file&&typeof file==='object'&&Number(file.size||0)>0){if(file.size>MAX_BYTES)return NextResponse.json({error:'invalid_file_size'},{status:400});if(!ALLOWED.has(file.type))return NextResponse.json({error:'unsupported_file_type'},{status:400});if(!storageConfigured())return NextResponse.json({error:'resume_storage_not_configured'},{status:503});}
 try{
   const result=await rpc('xzrecruiter_vendor_portal_submit',{p_portal_token:token,p_submission:payload||{}});
   if(!result?.ok){const status=result?.error==='invalid_or_expired'?401:result?.error==='job_not_shared'?404:400;return NextResponse.json(result,{status});}
   let resumeUploaded=false;
   if(file&&typeof file==='object'&&Number(file.size||0)>0&&result.status!=='DUPLICATE'){
     const prepared=await rpc('xzrecruiter_vendor_portal_prepare_resume',{p_portal_token:token,p_submission_id:result.id,p_filename:String(file.name||'resume'),p_mime_type:file.type,p_size_bytes:file.size});
     if(!prepared?.ok)return NextResponse.json({...result,resumeUploaded:false,resumeError:prepared?.error||'resume_prepare_failed'},{status:201});
     try{
       const bytes=Buffer.from(await file.arrayBuffer());await uploadPrivateObject(prepared.storage_path,bytes,file.type);
       const finalized=await rpc('xzrecruiter_vendor_portal_finalize_resume',{p_portal_token:token,p_submission_id:result.id,p_storage_path:prepared.storage_path,p_filename:prepared.filename,p_mime_type:file.type,p_size_bytes:file.size});
       resumeUploaded=Boolean(finalized?.ok);
     }catch(error){console.error('vendor_resume_upload_failed',error?.message||'');}
   }
   return NextResponse.json({...result,resumeUploaded},{status:201});
 }catch(error){console.error('vendor_portal_submit_failed',error?.message||'');return NextResponse.json({error:'Vendor portal is temporarily unavailable.'},{status:503});}
}
