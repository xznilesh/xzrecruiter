import { NextResponse } from 'next/server';
import { safeRequestId } from '@/lib/request-security';
import { serviceRpc,serviceRpcConfigured } from '@/lib/server-rpc';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function authorized(req){
  const expected=process.env.CRON_SECRET||process.env.XZ_AUTOMATION_CRON_SECRET||'';
  if(!expected)return false;
  const auth=String(req.headers.get('authorization')||'');
  return auth===`Bearer ${expected}`;
}
async function run(req){
  const requestId=safeRequestId(req);
  if(!authorized(req))return NextResponse.json({ok:false,error:'unauthorized',requestId},{status:401});
  if(!serviceRpcConfigured())return NextResponse.json({ok:false,error:'service_rpc_not_configured',requestId},{status:503});
  try{
    const result=await serviceRpc('xzrecruiter_run_step8_all_tenants',{p_worker:`cron:${requestId}`});
    return NextResponse.json({...result,requestId});
  }catch(error){
    console.error('step8_automation_run_failed',{requestId,error:error?.message||'unknown'});
    return NextResponse.json({ok:false,error:'automation_run_failed',requestId},{status:500});
  }
}
export async function GET(req){return run(req)}
export async function POST(req){return run(req)}
