import { cookies } from 'next/headers';
import { rpc } from '@/lib/supabase-api';

const COOKIE = 'xz_session';

export async function setSession(token) {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function sessionToken() {
  const store = await cookies();
  return store.get(COOKIE)?.value || '';
}

export async function getCurrentUser() {
  const token = await sessionToken();
  if (!token) return null;
  return rpc('xzrecruiter_me', { p_token: token });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value || '';
  if (token) {
    try { await rpc('xzrecruiter_logout', { p_token: token }); } catch {}
  }
  store.set(COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  });
}
