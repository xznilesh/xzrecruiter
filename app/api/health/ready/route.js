import { NextResponse } from 'next/server';
import { isDbConfigured, query } from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){
  const started=Date.now();
  if(!isDbConfigured()) return NextResponse.json({ok:false,service:'xzrecruiter',database:'not_configured'},{status:503});
  try{ await query('select 1 as ok'); return NextResponse.json({ok:true,service:'xzrecruiter',database:'ready',latency_ms:Date.now()-started,version:'1.0.0'}); }
  catch(e){ console.error('readiness_failed',e?.message); return NextResponse.json({ok:false,service:'xzrecruiter',database:'unreachable'},{status:503}); }
}
