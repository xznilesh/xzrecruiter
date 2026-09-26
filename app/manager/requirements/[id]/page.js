import { notFound,redirect } from 'next/navigation';
import AppShell from '@/app/components/AppShell';
import ManagerRequirementControl from '@/app/components/ManagerRequirementControl';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getManagerRequirement } from '@/lib/manager-control-server';

export const dynamic='force-dynamic';

export default async function ManagerRequirementPage({params}){
  const {id}=await params;
  const {user,globalContext}=await requireReadyWorkspace();
  const context=await getManagerRequirement(id).catch(()=>null);
  if(!context){
    if(!id)notFound();
    redirect('/manager?requirement=forbidden');
  }
  return <AppShell user={user} globalSettings={globalContext.settings} active="manager-control">
    <ManagerRequirementControl jobId={id} initialContext={context}/>
  </AppShell>;
}
