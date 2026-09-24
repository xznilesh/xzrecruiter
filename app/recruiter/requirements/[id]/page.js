import { notFound } from 'next/navigation';
import AppShell from '@/app/components/AppShell';
import RecruiterRequirementWorkspace from '@/app/components/RecruiterRequirementWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getRecruiterRequirement } from '@/lib/recruiter';

export const dynamic='force-dynamic';

export default async function RecruiterRequirementPage({params}){
  const {id}=await params;
  const {user,globalContext}=await requireReadyWorkspace();
  const context=await getRecruiterRequirement(id,50).catch(()=>null);
  if(!context?.ok)notFound();
  return <AppShell user={user} globalSettings={globalContext.settings} active="recruiter-work">
    <div className="page-heading">
      <div><span className="page-kicker">Recruiter execution · Requirement</span><h1>{context.job?.title||'Requirement'}</h1><p>{context.job?.account_name||'Account hidden / not assigned'} · approved recruiter-ready requirement</p></div>
      <a className="ghost-action" href="/recruiter">← Today</a>
    </div>
    <RecruiterRequirementWorkspace initialContext={context} jobId={id}/>
  </AppShell>;
}
