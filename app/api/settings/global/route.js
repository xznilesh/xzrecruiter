import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase-api';
import { sessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function sameOrigin(req) {
  const origin = req.headers.get('origin');
  return !origin || origin === req.nextUrl.origin;
}

export async function GET() {
  const token = await sessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const result = await rpc('xzrecruiter_global_context', { p_token: token });
    if (!result?.ok) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('global_context_failed', error?.message || '');
    return NextResponse.json({ error: 'Global settings are temporarily unavailable.' }, { status: 503 });
  }
}

export async function PUT(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const token = await sessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  try {
    const result = await rpc('xzrecruiter_update_global_settings', {
      p_token: token,
      p_country_code: String(body.countryCode || ''),
      p_locale: String(body.locale || ''),
      p_currency_code: String(body.currencyCode || ''),
      p_timezone_id: String(body.timezoneId || ''),
      p_language_code: String(body.languageCode || ''),
      p_time_format: String(body.timeFormat || 'AUTO')
    });
    if (!result?.ok) {
      const status = result?.error === 'forbidden' ? 403 : result?.error === 'unauthorized' ? 401 : 400;
      return NextResponse.json({ error: result?.error || 'Could not save settings.' }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('global_settings_update_failed', error?.message || '');
    return NextResponse.json({ error: 'Could not save global settings.' }, { status: 503 });
  }
}
