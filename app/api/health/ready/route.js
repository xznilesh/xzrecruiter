import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  try {
    const result = await rpc('xzrecruiter_public_health');
    if (!result?.ok) throw new Error('Health RPC returned not-ready');
    return NextResponse.json({
      ok: true,
      service: 'xzrecruiter',
      database: 'ready',
      latency_ms: Date.now() - started,
      version: '1.0.0'
    });
  } catch (error) {
    console.error('readiness_failed', error?.status || '', error?.message || '');
    return NextResponse.json({ ok: false, service: 'xzrecruiter', database: 'unreachable' }, { status: 503 });
  }
}
