import { notFound } from 'next/navigation';
import AppShell from '@/app/components/AppShell';
import JobProfileEditor from '@/app/components/JobProfileEditor';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { atsAction } from '@/lib/ats';

export const dynamic='force-dynamic';

export default async function JobProfilePage({params}){
  const {id}=await params;
  const {user,globalContext}=await requireReadyWorkspace();
  const result=await atsAction('jobProfileContext',{jobId:id}).catch(()=>null);
  if(!result?.ok||!result.job)notFound();
  const j=result.job;
  return <AppShell user={user} globalSettings={globalContext.settings} active="jobs">
    <div className="page-heading"><div><span className="page-kicker">Recruitment · Job 360</span><h1>{j.title}</h1><p>{[j.department,j.city,j.countryCode].filter(Boolean).join(' · ')||'Global requisition'}</p></div><a className="ghost-action" href="/jobs">← Job list</a></div>
    <JobProfileEditor job={j} clients={result.clients||[]} pipelines={result.pipelines||[]} countries={globalContext.countries||[]} timezones={globalContext.timezones||[]}/>
  </AppShell>;
}
