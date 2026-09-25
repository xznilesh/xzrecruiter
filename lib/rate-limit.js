import { createHash } from 'node:crypto';
import { rpc } from '@/lib/supabase-api';

function digestIdentity(scope,identity){
  const pepper=process.env.XZRECRUITER_RATE_LIMIT_PEPPER||'xzrecruiter-rate-limit-v1';
  return createHash('sha256').update(`${pepper}|${String(scope||'').toLowerCase()}|${String(identity||'anonymous')}`).digest('hex');
}

export async function consumeRateLimit({scope,identity,limit,windowSeconds}){
  const result=await rpc('xzrecruiter_consume_rate_limit',{
    p_scope:String(scope||'').toLowerCase(),
    p_key_hash:digestIdentity(scope,identity),
    p_limit:Number(limit),
    p_window_seconds:Number(windowSeconds)
  });
  return {
    ok:Boolean(result?.ok),
    allowed:Boolean(result?.allowed),
    remaining:Number(result?.remaining??0),
    resetAt:result?.reset_at||null,
    error:result?.error||null
  };
}

export function rateLimitIdentityForRequest(req,subject=''){
  const platform=req?.headers?.get?.('x-vercel-forwarded-for')||'';
  const forwarded=req?.headers?.get?.('x-forwarded-for')||'';
  const remote=String(platform||forwarded).split(',')[0].trim().slice(0,80);
  const agent=String(req?.headers?.get?.('user-agent')||'').slice(0,160);
  return `${String(subject||'').trim().toLowerCase()}|${remote||'no-ip'}|${agent||'no-agent'}`;
}
