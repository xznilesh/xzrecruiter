import { notFound } from 'next/navigation';
import AppShell from '@/app/components/AppShell';
import SubmissionPackWorkspace from '@/app/components/SubmissionPackWorkspace';
import { getSubmissionContext } from '@/lib/submissions';
import { requireReadyWorkspace } from '@/lib/workspace-ready';

export const dynamic='force-dynamic';
export default async function RecruiterSubmissionPage({params}){
  const {applicationId}=await params;
  const {user,globalContext}=await requireReadyWorkspace();
  const context=await getSubmissionContext(applicationId).catch(()=>null);
  if(!context?.ok)notFound();
  return <AppShell user={user} globalSettings={globalContext.settings} active="recruiter-work"><SubmissionPackWorkspace initialContext={context} applicationId={applicationId} mode="recruiter"/></AppShell>;
}
