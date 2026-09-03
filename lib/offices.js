import { sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

export async function getOfficeContext() {
  const token=await sessionToken();
  if(!token) return null;
  const result=await rpc('xzrecruiter_office_context',{p_token:token});
  return result?.ok?result:null;
}
