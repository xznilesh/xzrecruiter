import { notFound } from 'next/navigation';
import AppShell from '@/app/components/AppShell';
import JdBrainWorkspace from '@/app/components/JdBrainWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getRequirementContext } from '@/lib/jd';
import { jdAiConfigured } from '@/lib/jd-ai-server';

export const dynamic='force-dynamic';

export default async function RequirementIntelligencePage({params}){
  const {id}=await params;
  const {user,globalContext}=await requireReadyWorkspace();
  const context=await getRequirementContext(id).catch(()=>null);
  if(!context?.ok||!context.job)notFound();
  return <AppShell user={user} globalSettings={globalContext.settings} active="jobs">
    <div className="page-heading">
      <div><span className="page-kicker">Recruitment · AI JD Brain</span><h1>{context.job.title||'Requirement'}</h1><p>Source JD → explainable AI brief → Account Manager approval → recruiter-ready requirement.</p></div>
      <a className="ghost-action" href={`/jobs/${id}`}>← Job 360</a>
    </div>
    <JdBrainWorkspace jobId={id} initialContext={context} aiConfigured={jdAiConfigured()}/>
  </AppShell>;
}
