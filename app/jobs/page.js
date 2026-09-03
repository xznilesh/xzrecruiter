import AppShell from '@/app/components/AppShell';
import JobWorkspace from '@/app/components/JobWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getJobSearch, getSavedViews } from '@/lib/ats';

export const dynamic='force-dynamic';

export default async function JobsPage({searchParams}){
  const params=await searchParams;
  const {user,globalContext,onboarding}=await requireReadyWorkspace();
  const page=Math.max(1,Number(params?.page||1));const limit=50;
  const filters={countryCode:String(params?.country||''),status:String(params?.status||''),priority:String(params?.priority||''),workplace:String(params?.workplace||''),pipelineId:String(params?.pipeline||'')};
  const [context,savedViews]=await Promise.all([
    getJobSearch(String(params?.q||''),filters,limit,(page-1)*limit),
    getSavedViews('JOB')
  ]);
  const pipelines=(onboarding.pipelines||[]).filter((p)=>p.pipeline_kind==='RECRUITMENT'&&p.active!==false);
  return <AppShell user={user} globalSettings={globalContext.settings} active="jobs"><div className="page-heading"><div><span className="page-kicker">Recruitment</span><h1>Jobs</h1><p>Global requisitions with saved views, server-side filters, configurable pipelines, salary context and public/private visibility.</p></div><span className="status good">● {pipelines.length} pipeline{pipelines.length===1?'':'s'}</span></div><JobWorkspace context={context||{rows:[],total:0,limit,offset:0}} countries={globalContext.countries||[]} timezones={globalContext.timezones||[]} pipelines={pipelines} savedViews={savedViews}/></AppShell>;
}
