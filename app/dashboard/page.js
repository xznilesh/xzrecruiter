import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppShell from '@/app/components/AppShell';
import { getCurrentUser, sessionToken } from '@/lib/auth';
import { getGlobalContext } from '@/lib/global-context';
import { rpc } from '@/lib/supabase-api';
import { formatDateTime } from '@/lib/globalization';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  let user;
  try { user = await getCurrentUser(); }
  catch (error) { console.error('me_rpc_failed', error?.message); redirect('/login?error=service'); }
  if (!user) redirect('/login');

  const token = await sessionToken();
  let d = { metrics: { companies: 0, jobs: 0, hot: 0, clients: 0, candidates: 0 }, signals: [], pipeline: [] };
  try {
    const result = await rpc('xzrecruiter_dashboard', { p_token: token });
    if (!result?.ok) redirect('/login');
    d = result;
  } catch (error) { console.error('dashboard_rpc_failed', error?.message); }

  let globalContext = null;
  try { globalContext = await getGlobalContext(); }
  catch (error) { console.error('global_context_dashboard_failed', error?.message || ''); }
  const settings = globalContext?.settings || { country_name: 'Global workspace', locale: 'en-GB', currency_code: 'GBP', timezone_id: 'UTC', language_code: 'en', direction: 'LTR' };

  const m = d.metrics || {};
  const signals = Array.isArray(d.signals) ? d.signals : [];
  const pipeline = Array.isArray(d.pipeline) ? d.pipeline : [];
  const max = Math.max(1, ...pipeline.map((x) => Number(x.n) || 0));
  const localNow = formatDateTime(new Date(), { locale: settings.locale || 'en-GB', timezone: settings.timezone_id || 'UTC' });

  return <AppShell user={user} globalSettings={settings} active="home">
    <div className="page-heading dashboard-heading"><div><span className="page-kicker">Hiring command center</span><h1>Good to see you, {user.display_name || 'Recruiter'}.</h1><p>Prioritize hiring demand and recruitment work without losing your workspace, market or timezone context.</p></div><div className="heading-statuses"><span className="status good">● Systems operational</span><span className="status neutral">{settings.country_name} · {settings.timezone_id}</span></div></div>

    <div className="fast-action-strip" aria-label="Fast actions">
      <div><b>Fast-action workspace</b><span>Use <kbd>Ctrl/Cmd + K</kbd> to search or jump anywhere.</span></div>
      <Link href="/settings/global" className="small-action">Global settings</Link>
      <button type="button" disabled title="Candidate creation arrives in a later step">＋ Candidate <small>Later</small></button>
      <button type="button" disabled title="Job creation arrives in a later step">＋ Job <small>Later</small></button>
    </div>

    <div className="dashmetrics premium-metrics">
      <div className="dmetric"><span>Tracked companies</span><b>{m.companies || 0}</b><small>global market coverage</small></div>
      <div className="dmetric"><span>Active jobs</span><b>{m.jobs || 0}</b><small>live hiring demand</small></div>
      <div className="dmetric"><span>Hot accounts</span><b>{m.hot || 0}</b><small>priority outreach</small></div>
      <div className="dmetric"><span>Active clients</span><b>{m.clients || 0}</b><small>workspace owned</small></div>
    </div>

    <div className="global-context-card">
      <div><span className="eyebrow-mini">Viewer context</span><h2>{settings.country_name}</h2><p>{localNow}</p></div>
      <dl><div><dt>Locale</dt><dd>{settings.locale}</dd></div><div><dt>Currency</dt><dd>{settings.currency_code}</dd></div><div><dt>Timezone</dt><dd>{settings.timezone_id}</dd></div><div><dt>Language</dt><dd>{settings.language_code?.toUpperCase()}</dd></div></dl>
      <Link href="/settings/global">Change operating context →</Link>
    </div>

    <div className="panels premium-panels">
      <div className="panel"><div className="panel-title-row"><div><h2>Today’s highest-priority accounts</h2><div className="panel-sub">Hiring Heat combines freshness, urgency, trust and your agency fit.</div></div><span className="panel-badge">Live intelligence</span></div>{signals.length ? <div className="table"><div className="tr head"><div>Company</div><div>Heat</div><div>Fit</div><div>Recommendation</div></div>{signals.map((s, i) => <div className="tr" key={i}><div><b>{s.name}</b><div className="row-sub">{s.why_now_summary}</div></div><div className="heat">{s.heat_score}</div><div>{s.fit_score ?? '—'}%</div><div><span className="pill">{s.recommendation}</span></div></div>)}</div> : <div className="empty"><b>Your intelligence radar is ready.</b><span>No scored accounts yet. Signals will appear here as monitored companies are processed.</span></div>}</div>
      <div className="panel"><h2>Recruitment pipeline</h2><div className="panel-sub">{m.candidates || 0} candidates currently isolated to this workspace.</div>{pipeline.length ? <div className="bars">{pipeline.map((p) => <div className="barline" key={p.stage}><span>{p.stage}</span><div className="bar"><i style={{ width: `${Math.max(6, (Number(p.n) || 0) / max * 100)}%` }} /></div><b>{p.n}</b></div>)}</div> : <div className="empty"><b>Pipeline ready</b><span>Candidate operations will plug into this shell without changing navigation or tenancy.</span></div>}</div>
    </div>
  </AppShell>;
}
