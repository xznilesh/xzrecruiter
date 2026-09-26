import {SUPABASE_URL} from '@/lib/supabase-api';
import {assertSafeStoragePath,validatePrivateUpload} from '@/lib/file-security';
import {scanPrivateUpload} from '@/lib/malware-scan';

const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
export const RECRUITMENT_BUCKET=process.env.XZRECRUITER_STORAGE_BUCKET||'xzrecruiter-private';
export const SENSITIVE_DOCUMENT_BUCKET=process.env.XZRECRUITER_SENSITIVE_STORAGE_BUCKET||RECRUITMENT_BUCKET;

function safeBucket(value){
  const bucket=String(value||'');
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{1,62}$/.test(bucket))throw new Error('unsafe_storage_bucket');
  return bucket;
}
function encodedPath(path){return assertSafeStoragePath(path).split('/').map(encodeURIComponent).join('/')}
function objectUrl(bucket,path){return `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(safeBucket(bucket))}/${encodedPath(path)}`}

export function storageConfigured(){return Boolean(SERVICE_KEY&&SUPABASE_URL)}

export async function uploadPrivateObject(path,bytes,mimeType,bucket=RECRUITMENT_BUCKET){
  if(!storageConfigured())throw new Error('storage_not_configured');
  const safePath=assertSafeStoragePath(path);
  const checked=validatePrivateUpload({bytes,mimeType,storagePath:safePath,sizeBytes:Buffer.byteLength(bytes)});
  await scanPrivateUpload({bytes:checked.buffer,mimeType:checked.mimeType,filename:safePath.split('/').pop()||'upload'});
  const response=await fetch(objectUrl(bucket,safePath),{
    method:'POST',
    headers:{
      apikey:SERVICE_KEY,
      authorization:`Bearer ${SERVICE_KEY}`,
      'content-type':checked.mimeType,
      'x-upsert':'false',
      'cache-control':'private, no-store'
    },
    body:checked.buffer,
    cache:'no-store'
  });
  if(!response.ok){
    const error=new Error('storage_upload_failed');
    error.status=response.status;
    throw error;
  }
  return true;
}

export async function createSignedPrivateUrl(path,expiresIn=60,bucket=RECRUITMENT_BUCKET){
  if(!storageConfigured())throw new Error('storage_not_configured');
  const safePath=assertSafeStoragePath(path);
  const ttl=Math.max(15,Math.min(Number(expiresIn||60),60));
  const response=await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(safeBucket(bucket))}/${encodedPath(safePath)}`,{
    method:'POST',
    headers:{
      apikey:SERVICE_KEY,
      authorization:`Bearer ${SERVICE_KEY}`,
      'content-type':'application/json'
    },
    body:JSON.stringify({expiresIn:ttl}),
    cache:'no-store'
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.signedURL){
    const error=new Error('storage_sign_failed');
    error.status=response.status;
    throw error;
  }
  return data.signedURL.startsWith('http')?data.signedURL:`${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

export async function removePrivateObject(path,bucket=RECRUITMENT_BUCKET){
  if(!storageConfigured()||!path)return false;
  const safePath=assertSafeStoragePath(path);
  const response=await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(safeBucket(bucket))}`,{
    method:'DELETE',
    headers:{
      apikey:SERVICE_KEY,
      authorization:`Bearer ${SERVICE_KEY}`,
      'content-type':'application/json'
    },
    body:JSON.stringify({prefixes:[safePath]}),
    cache:'no-store'
  });
  return response.ok;
}
