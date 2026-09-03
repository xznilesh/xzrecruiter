import { NextResponse } from 'next/server';
import { sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

function sameOrigin(req) {
  const origin = req.headers.get('origin');
  return !origin || origin === req.nextUrl.origin;
}

const actions = {
  pipeline: ['xzrecruiter_save_pipeline', (body, token) => ({ p_token: token, p_pipeline: body.payload || {} })],
  customField: ['xzrecruiter_save_custom_field', (body, token) => ({ p_token: token, p_field: body.payload || {} })],
  savedView: ['xzrecruiter_save_view', (body, token) => ({ p_token: token, p_view: body.payload || {} })],
  territory: ['xzrecruiter_save_territory', (body, token) => ({ p_token: token, p_territory: body.payload || {} })],
  office: ['xzrecruiter_save_office', (body, token) => ({ p_token: token, p_office: body.payload || {} })],
  layout: ['xzrecruiter_save_layout', (body, token) => ({ p_token: token, p_layout: body.payload || {} })],
  candidateAuthorization: ['xzrecruiter_save_candidate_authorization_profile', (body, token) => ({ p_token: token, p_payload: body.payload || {} })],
  customTaxonomy: ['xzrecruiter_add_custom_taxonomy', (body, token) => ({
    p_token: token,
    p_domain: String(body.payload?.domain || ''),
    p_parent_id: body.payload?.parentId || null,
    p_label: String(body.payload?.label || '')
  })]
};

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const token = await sessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const config = actions[body.action];
  if (!config) return NextResponse.json({ error: 'Unsupported configuration action.' }, { status: 400 });
  try {
    const result = await rpc(config[0], config[1](body, token));
    if (!result?.ok) {
      const status = result?.error === 'unauthorized' ? 401 : result?.error === 'forbidden' ? 403 : 400;
      return NextResponse.json({ error: result?.error || 'Could not save configuration.' }, { status });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('configuration_save_failed', body.action, error?.message || '');
    return NextResponse.json({ error: 'Could not save configuration.' }, { status: 503 });
  }
}
