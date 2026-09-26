import AppShell from '@/app/components/AppShell';
import AccountManagerSubmissionQueue from '@/app/components/AccountManagerSubmissionQueue';
import { getSubmissionQueue } from '@/lib/submissions';
import { requireReadyWorkspace } from '@/lib/workspace-ready';

export const dynamic='force-dynamic';
export default async function AccountManagerSubmissionsPage(){
  const {user,globalContext}=await requireReadyWorkspace();
  const queue=await getSubmissionQueue('WAITING_FOR_REVIEW',30,0).catch(()=>null);
  return <AppShell user={user} globalSettings={globalContext.settings} active="recruiter-work"><AccountManagerSubmissionQueue initial={queue?.ok?queue:{ok:true,bucket:'WAITING_FOR_REVIEW',rows:[],total:0}}/></AppShell>;
}
