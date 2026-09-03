import AppShell from '@/app/components/AppShell';
import JobWorkspace from '@/app/components/JobWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getAtsContext } from '@/lib/ats';

export const dynamic='force-dynamic';

export default async function JobsPage({searchParams}){
  const params=await searchParams;
  const {user,globalContext,onboarding}=await requireReadyWorkspace();
  const context=await getAtsContext('JOBS',String(params?.q||''),50,0);
  const pipelines=(onboarding.pipelines||[]).filter((p)=>p.pipeline_kind==='RECRUITMENT'&&p.active!==false);
  return <AppShell user={user} globalSettings={globalContext.settings} active="jobs"><div className="page-heading"><div><span className="page-kicker">Recruitment</span><h1>Jobs</h1><p>Global requisitions with configurable pipelines, salary context and public/private visibility.</p></div><span className="status good">● {pipelines.length} pipeline{pipelines.length===1?'':'s'}</span></div><JobWorkspace context={context||{rows:[],total:0}} countries={globalContext.countries||[]} timezones={globalContext.timezones||[]} pipelines={pipelines}/></AppShell>;
}
