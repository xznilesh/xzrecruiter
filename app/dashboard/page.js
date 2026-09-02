import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic='force-dynamic';

async function load(user){
  const agency=user.agency_id;
  const [companies,jobs,hot,clients,candidates,signals,pipeline]=await Promise.all([
    query('select count(*)::int n from companies where active=true'),
    query('select count(*)::int n from canonical_jobs where active=true'),
    query('select count(*)::int n from agency_company_hiring_heat where agency_id=$1 and heat_score>=70',[agency]),
    query("select count(*)::int n from recruitment_clients where agency_id=$1 and status='ACTIVE'",[agency]),
    query('select count(*)::int n from candidates where agency_id=$1',[agency]),
    query(`select c.name,h.heat_score,h.recommendation,h.why_now_summary,f.fit_score
      from agency_company_hiring_heat h join companies c on c.id=h.company_id
      left join agency_company_fit_scores f on f.agency_id=h.agency_id and f.company_id=h.company_id
      where h.agency_id=$1 order by h.heat_score desc,h.updated_at desc limit 8`,[agency]),
    query(`select stage,count(*)::int n from applications where agency_id=$1 and status='ACTIVE' group by stage order by count(*) desc`,[agency])
  ]);
  return {companies:companies.rows[0]?.n||0,jobs:jobs.rows[0]?.n||0,hot:hot.rows[0]?.n||0,clients:clients.rows[0]?.n||0,candidates:candidates.rows[0]?.n||0,signals:signals.rows,pipeline:pipeline.rows};
}

const Brand=()=> <div className="brand"><div className="brandmark">XZ</div><div className="brandname">XZ<span>Recruiter</span></div></div>;
export default async function Dashboard(){
  let user; try{user=await getCurrentUser();}catch{redirect('/login?error=db');} if(!user)redirect('/login');
  let d; try{d=await load(user);}catch(e){console.error('dashboard_load_failed',e?.message);d={companies:0,jobs:0,hot:0,clients:0,candidates:0,signals:[],pipeline:[]};}
  const max=Math.max(1,...d.pipeline.map(x=>x.n));
  return <main className="dash"><header className="dashbar"><div className="shell"><Brand/><div style={{display:'flex',alignItems:'center',gap:14}}><span className="muted" style={{fontSize:13}}>{user.agency_name}</span><form action="/api/auth/logout" method="post"><button className="logout">Sign out</button></form></div></div></header><div className="dashgrid"><aside className="dashside"><a className="active">Today’s Radar</a><a>Companies</a><a>Jobs & signals</a><a>Clients</a><a>Candidates</a><a>Pipeline</a><a>Reports</a><a>Settings</a></aside><section className="dashmain"><div className="dashhead"><div><h1>Good to see you, {user.display_name||'Recruiter'}.</h1><p>Here’s what your hiring market is doing right now.</p></div><span className="status">● Database connected</span></div><div className="dashmetrics"><div className="dmetric"><span>Tracked companies</span><b>{d.companies}</b></div><div className="dmetric"><span>Active jobs</span><b>{d.jobs}</b></div><div className="dmetric"><span>Hot accounts</span><b>{d.hot}</b></div><div className="dmetric"><span>Active clients</span><b>{d.clients}</b></div></div><div className="panels"><div className="panel"><h2>Today’s highest-priority accounts</h2><div className="panel-sub">Hiring Heat combines freshness, urgency, trust and your agency fit.</div>{d.signals.length?<div className="table"><div className="tr head"><div>Company</div><div>Heat</div><div>Fit</div><div>Recommendation</div></div>{d.signals.map((s,i)=><div className="tr" key={i}><div><b>{s.name}</b><div style={{color:'#768297',fontSize:11,marginTop:4}}>{s.why_now_summary}</div></div><div className="heat">{s.heat_score}</div><div>{s.fit_score??'—'}%</div><div><span className="pill">{s.recommendation}</span></div></div>)}</div>:<div className="empty">No scored accounts yet. Your radar will populate as monitored company signals are processed.</div>}</div><div className="panel"><h2>Recruitment pipeline</h2><div className="panel-sub">{d.candidates} candidates currently in your workspace.</div>{d.pipeline.length?<div className="bars">{d.pipeline.map((p)=><div className="barline" key={p.stage}><span>{p.stage}</span><div className="bar"><i style={{width:`${Math.max(6,p.n/max*100)}%`}}/></div><b>{p.n}</b></div>)}</div>:<div className="empty">Pipeline is ready for your first candidate.</div>}</div></div></section></div></main>
}
