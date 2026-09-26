import {createHash} from 'node:crypto';
import {SUPABASE_URL} from '@/lib/supabase-api';

const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';

function digestIdentity(scope,identity){
  const pepper=process.env.XZRECRUITER_RATE_LIMIT_PEPPER||'';
  if(!pepper)throw new Error('rate_limit_pepper_not_configured');
  return createHash('sha256').update(`${pepper}|${String(scope||'').toLowerCase()}|${String(identity||'anonymous')}`).digest('hex');
}

export function rateLimitConfigured(){
  return Boolean(SERVICE_KEY&&SUPABASE_URL&&process.env.XZRECRUITER_RATE_LIMIT_PEPPER);
}
export async function consumeRateLimit({scope,identity,limit,windowSeconds}){
  if(!rateLimitConfigured())throw new Error('rate_limit_not_configured');
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/xzrecruiter_consume_rate_limit`,{
    method:'POST',
    headers:{apikey:SERVICE_KEY,authorization:`Bearer ${SERVICE_KEY}`,'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({
      p_scope:String(scope||'').toLowerCase(),p_key_hash:digestIdentity(scope,identity),
      p_limit:Number(limit),p_window_seconds:Number(windowSeconds)
    }),
    cache:'no-store'
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok||!result?.ok)throw new Error('rate_limit_unavailable');
  return {ok:true,allowed:Boolean(result.allowed),remaining:Number(result.remaining??0),resetAt:result.reset_at||null};
}
export function rateLimitIdentityForRequest(req,subject=''){
  const platform=req?.headers?.get?.('x-vercel-forwarded-for')||'';
  const forwarded=req?.headers?.get?.('x-forwarded-for')||'';
  const remote=String(platform||forwarded).split(',')[0].trim().slice(0,80);
  const agent=String(req?.headers?.get?.('user-agent')||'').slice(0,160);
  return `${String(subject||'').trim().toLowerCase()}|${remote||'no-ip'}|${agent||'no-agent'}`;
}
