import { cookies } from 'next/headers';
import { rpc } from '@/lib/supabase-api';

const COOKIE = process.env.NODE_ENV === 'production' ? '__Host-xz_session' : 'xz_session';
const LEGACY_COOKIE = 'xz_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function cookieOptions(maxAge = SESSION_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge
  };
}

export async function setSession(token) {
  if (!token) throw new Error('Session token is required');
  const store = await cookies();
  store.set(COOKIE, token, cookieOptions());
  if (COOKIE !== LEGACY_COOKIE) store.set(LEGACY_COOKIE, '', cookieOptions(0));
}

export async function sessionToken() {
  const store = await cookies();
  return store.get(COOKIE)?.value || store.get(LEGACY_COOKIE)?.value || '';
}

export async function getCurrentUser() {
  const token = await sessionToken();
  if (!token) return null;
  return rpc('xzrecruiter_me', { p_token: token });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value || store.get(LEGACY_COOKIE)?.value || '';
  if (token) {
    try { await rpc('xzrecruiter_logout', { p_token: token }); } catch {}
  }
  store.set(COOKIE, '', cookieOptions(0));
  if (COOKIE !== LEGACY_COOKIE) store.set(LEGACY_COOKIE, '', cookieOptions(0));
}
