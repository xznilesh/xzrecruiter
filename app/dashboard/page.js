import { redirect } from 'next/navigation';
import { getCurrentUser, sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

export const dynamic = 'force-dynamic';

const Brand = () => <div className="brand"><div className="brandmark">XZ</div><div className="brandname">XZ<span>Recruiter</span></div></div>;

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
    <header className="dashbar"><div className="shell"><Brand/><div style={{display:'flex',alignItems:'center',gap:14}}><span className="muted" style={{fontSize:13}}>{user.agency_name}</span><form action="/api/auth/logout" method="post"><button className="logout">Sign out</button></form></div></div></header>
    <div className="dashgrid">
      <aside className="dashside"><a className="active">Today’s Radar</a><a>Companies</a><a>Jobs & signals</a><a>Clients</a><a>Candidates</a><a>Pipeline</a><a>Reports</a><a>Settings</a></aside>
      <section className="dashmain">
        <div className="dashhead"><div><h1>Good to see you, {user.display_name || 'Recruiter'}.</h1><p>Here’s what your hiring market is doing right now.</p></div><span className="status">● Database connected</span></div>
        <div className="dashmetrics"><div className="dmetric"><span>Tracked companies</span><b>{m.companies || 0}</b></div><div className="dmetric"><span>Active jobs</span><b>{m.jobs || 0}</b></div><div className="dmetric"><span>Hot accounts</span><b>{m.hot || 0}</b></div><div className="dmetric"><span>Active clients</span><b>{m.clients || 0}</b></div></div>
        <div className="panels">
          <div className="panel"><h2>Today’s highest-priority accounts</h2><div className="panel-sub">Hiring Heat combines freshness, urgency, trust and your agency fit.</div>{signals.length ? <div className="table"><div className="tr head"><div>Company</div><div>Heat</div><div>Fit</div><div>Recommendation</div></div>{signals.map((s,i)=><div className="tr" key={i}><div><b>{s.name}</b><div style={{color:'#768297',fontSize:11,marginTop:4}}>{s.why_now_summary}</div></div><div className="heat">{s.heat_score}</div><div>{s.fit_score ?? '—'}%</div><div><span className="pill">{s.recommendation}</span></div></div>)}</div> : <div className="empty">No scored accounts yet. Your radar will populate as monitored company signals are processed.</div>}</div>
          <div className="panel"><h2>Recruitment pipeline</h2><div className="panel-sub">{m.candidates || 0} candidates currently in your workspace.</div>{pipeline.length ? <div className="bars">{pipeline.map((p)=><div className="barline" key={p.stage}><span>{p.stage}</span><div className="bar"><i style={{width:`${Math.max(6,(Number(p.n)||0)/max*100)}%`}}/></div><b>{p.n}</b></div>)}</div> : <div className="empty">Pipeline is ready for your first candidate.</div>}</div>
        </div>
      </section>
    </div>
  </main>;
}
