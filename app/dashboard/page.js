import { redirect } from 'next/navigation';
import Brand from '@/app/components/Brand';
import { getCurrentUser, sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

export const dynamic = 'force-dynamic';

const nav = ['Today’s Radar', 'Companies', 'Jobs & signals', 'Clients', 'Candidates', 'Pipeline', 'Reports', 'Settings'];

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
  } catch (error) {
    console.error('dashboard_rpc_failed', error?.message);
  }

  const m = d.metrics || {};
  const signals = Array.isArray(d.signals) ? d.signals : [];
  const pipeline = Array.isArray(d.pipeline) ? d.pipeline : [];
  const max = Math.max(1, ...pipeline.map((x) => Number(x.n) || 0));

  return <main className="dash">
    <header className="dashbar"><div className="dashbar-inner">
      <Brand compact />
      <div className="workspace-meta"><div><strong>{user.agency_name}</strong><span>{user.role || 'MEMBER'} workspace</span></div><span className="verified-chip">✓ Verified</span><form action="/api/auth/logout" method="post"><button className="logout">Sign out</button></form></div>
    </div></header>

    <div className="dashmobile" aria-label="Mobile workspace navigation">{nav.slice(0, 6).map((item, index) => <a className={index === 0 ? 'active' : ''} key={item}>{item}</a>)}</div>

    <div className="dashgrid">
      <aside className="dashside"><div className="nav-group-label">Workspace</div>{nav.map((item, index) => <a className={index === 0 ? 'active' : ''} key={item}>{item}</a>)}<div className="side-security"><b>Secure workspace</b><span>Email verified</span><span>Role: {user.role || 'MEMBER'}</span><span>Tenant isolated</span></div></aside>
      <section className="dashmain">
        <div className="dashhead"><div><div className="form-kicker">Hiring command center</div><h1>Good to see you, {user.display_name || 'Recruiter'}.</h1><p>Prioritize companies, move recruiter work forward, and keep every action inside {user.agency_name}.</p></div><span className="status">● Systems operational</span></div>

        <div className="dashmetrics">
          <div className="dmetric"><span>Tracked companies</span><b>{m.companies || 0}</b><small>market coverage</small></div>
          <div className="dmetric"><span>Active jobs</span><b>{m.jobs || 0}</b><small>live hiring demand</small></div>
          <div className="dmetric"><span>Hot accounts</span><b>{m.hot || 0}</b><small>priority outreach</small></div>
          <div className="dmetric"><span>Active clients</span><b>{m.clients || 0}</b><small>workspace owned</small></div>
        </div>

        <div className="panels">
          <div className="panel"><div className="panel-title-row"><div><h2>Today’s highest-priority accounts</h2><div className="panel-sub">Hiring Heat combines freshness, urgency, trust and your agency fit.</div></div><span className="panel-badge">Live intelligence</span></div>{signals.length ? <div className="table"><div className="tr head"><div>Company</div><div>Heat</div><div>Fit</div><div>Recommendation</div></div>{signals.map((s, i) => <div className="tr" key={i}><div><b>{s.name}</b><div className="row-sub">{s.why_now_summary}</div></div><div className="heat">{s.heat_score}</div><div>{s.fit_score ?? '—'}%</div><div><span className="pill">{s.recommendation}</span></div></div>)}</div> : <div className="empty"><b>Your intelligence radar is ready.</b><span>No scored accounts yet. Signals will appear here as monitored companies are processed.</span></div>}</div>
          <div className="panel"><h2>Recruitment pipeline</h2><div className="panel-sub">{m.candidates || 0} candidates currently isolated to your workspace.</div>{pipeline.length ? <div className="bars">{pipeline.map((p) => <div className="barline" key={p.stage}><span>{p.stage}</span><div className="bar"><i style={{ width: `${Math.max(6, (Number(p.n) || 0) / max * 100)}%` }} /></div><b>{p.n}</b></div>)}</div> : <div className="empty"><b>Pipeline ready</b><span>Add your first candidate when recruitment operations go live.</span></div>}</div>
        </div>
      </section>
    </div>
  </main>;
}
