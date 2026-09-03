import { SUPABASE_URL } from '@/lib/supabase-api';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const RECRUITMENT_BUCKET = process.env.XZRECRUITER_STORAGE_BUCKET || 'xzrecruiter-private';

function encodedPath(path) {
  return String(path || '').split('/').map(encodeURIComponent).join('/');
}

function objectUrl(bucket, path) {
  return `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath(path)}`;
}

export function storageConfigured() {
  return Boolean(SERVICE_KEY && SUPABASE_URL);
}

export async function uploadPrivateObject(path, bytes, mimeType, bucket = RECRUITMENT_BUCKET) {
  if (!storageConfigured()) throw new Error('storage_not_configured');
  const response = await fetch(objectUrl(bucket, path), {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': mimeType || 'application/octet-stream',
      'x-upsert': 'false'
    },
    body: bytes,
    cache: 'no-store'
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    const error = new Error(`storage_upload_failed_${response.status}`);
    error.details = details.slice(0, 1000);
    throw error;
  }
  return true;
}

export async function createSignedPrivateUrl(path, expiresIn = 60, bucket = RECRUITMENT_BUCKET) {
  if (!storageConfigured()) throw new Error('storage_not_configured');
  const ttl = Math.max(30, Math.min(Number(expiresIn || 60), 300));
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath(path)}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ expiresIn: ttl }),
    cache: 'no-store'
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.signedURL) {
    const error = new Error(`storage_sign_failed_${response.status}`);
    error.details = data;
    throw error;
  }
  return data.signedURL.startsWith('http') ? data.signedURL : `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

export async function removePrivateObject(path, bucket = RECRUITMENT_BUCKET) {
  if (!storageConfigured() || !path) return false;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ prefixes: [path] }),
    cache: 'no-store'
  });
  return response.ok;
}
