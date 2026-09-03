import { NextResponse } from 'next/server';
import { sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

function sameOrigin(req) {
  const origin = req.headers.get('origin');
  return !origin || origin === req.nextUrl.origin;
}

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const token = await sessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  try {
    if (body.action === 'stage') {
      if (!Array.isArray(body.rows) || body.rows.length > 1000) return NextResponse.json({ error: 'Step-3 imports support up to 1,000 rows per batch.' }, { status: 400 });
      const result = await rpc('xzrecruiter_stage_import', {
        p_token: token,
        p_entity_type: String(body.entityType || ''),
        p_filename: String(body.filename || 'import.csv'),
        p_idempotency_key: String(body.idempotencyKey || ''),
        p_headers: Array.isArray(body.headers) ? body.headers : [],
        p_mapping: body.mapping || {},
        p_rows: body.rows
      });
      if (!result?.ok) return NextResponse.json({ error: result?.error || 'Import validation failed.' }, { status: result?.error === 'forbidden' ? 403 : 400 });
      return NextResponse.json(result);
    }
    if (body.action === 'commit') {
      const result = await rpc('xzrecruiter_commit_import', { p_token: token, p_batch_id: body.batchId || null });
      if (!result?.ok) return NextResponse.json({ error: result?.error || 'Import commit failed.' }, { status: result?.error === 'forbidden' ? 403 : 400 });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'Unsupported import action.' }, { status: 400 });
  } catch (error) {
    console.error('step3_import_failed', body.action, error?.message || '');
    return NextResponse.json({ error: 'Import is temporarily unavailable.' }, { status: 503 });
  }
}
