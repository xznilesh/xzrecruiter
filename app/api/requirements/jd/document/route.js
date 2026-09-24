import { NextResponse } from 'next/server';
import { jdAction } from '@/lib/jd';
import { createSignedPrivateUrl, storageConfigured } from '@/lib/server-storage';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function sameOrigin(req){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin}
function uuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))}

export async function GET(req){
  if(!sameOrigin(req))return NextResponse.json({error:'invalid_origin'},{status:403});
  if(!storageConfigured())return NextResponse.json({error:'storage_not_configured'},{status:503});
  const sourceId=req.nextUrl.searchParams.get('sourceId')||'';
  if(!uuid(sourceId))return NextResponse.json({error:'invalid_source'},{status:400});
  const access=await jdAction('documentAccess',{sourceId}).catch(()=>null);
  if(!access?.ok)return NextResponse.json(access||{error:'jd_document_not_found'},{status:access?.error==='am_only'?403:404});
  try{
    const signedUrl=await createSignedPrivateUrl(access.storage_path,60);
    return NextResponse.redirect(signedUrl,302);
  }catch(error){
    console.error('jd_document_access_failed',error?.message||'');
    return NextResponse.json({error:'jd_document_temporarily_unavailable'},{status:503});
  }
}
