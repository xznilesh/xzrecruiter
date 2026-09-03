import { rpc } from '@/lib/supabase-api';
import { sessionToken } from '@/lib/auth';

export async function getGlobalContext() {
  const token = await sessionToken();
  if (!token) return null;
  const result = await rpc('xzrecruiter_global_context', { p_token: token });
  return result?.ok ? result : null;
}

export async function getTaxonomy(domain) {
  const token = await sessionToken();
  if (!token) return [];
  const result = await rpc('xzrecruiter_taxonomy', { p_token: token, p_domain: domain });
  return result?.ok && Array.isArray(result.items) ? result.items : [];
}
