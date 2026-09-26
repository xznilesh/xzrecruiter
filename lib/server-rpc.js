import { SUPABASE_URL } from '@/lib/supabase-api';

const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';

async function parse(response){
  const text=await response.text();
  if(!text)return null;
  try{return JSON.parse(text)}catch{return text}
}

export function serviceRpcConfigured(){return Boolean(SERVICE_KEY&&SUPABASE_URL)}

export async function serviceRpc(name,args={}){
  if(!serviceRpcConfigured())throw new Error('service_rpc_not_configured');
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(name)}`,{
    method:'POST',
    headers:{
      apikey:SERVICE_KEY,
      authorization:`Bearer ${SERVICE_KEY}`,
      'content-type':'application/json',
      accept:'application/json'
    },
    body:JSON.stringify(args),
    cache:'no-store'
  });
  const data=await parse(response);
  if(!response.ok){
    const error=new Error('service_rpc_failed');
    error.status=response.status;
    error.details=data;
    throw error;
  }
  return data;
}
