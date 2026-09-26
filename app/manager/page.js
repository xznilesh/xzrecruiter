import { redirect } from 'next/navigation';
import AppShell from '@/app/components/AppShell';
import ManagerControlCenter from '@/app/components/ManagerControlCenter';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getAutomationNotifications,getManagerAnalytics,getManagerControlCenter } from '@/lib/manager-control-server';

export const dynamic='force-dynamic';

export default async function ManagerControlPage(){
  const {user,globalContext}=await requireReadyWorkspace();
  const [home,notifications,analytics]=await Promise.all([
    getManagerControlCenter(50).catch(()=>null),
    getAutomationNotifications(75).catch(()=>null),
    getManagerAnalytics({}).catch(()=>null)
  ]);
  if(!home?.ok)redirect('/dashboard?manager=forbidden');
  return <AppShell user={user} globalSettings={globalContext.settings} active="manager-control">
    <ManagerControlCenter initialHome={home} initialNotifications={notifications||{notifications:[]}} initialAnalytics={analytics||{funnel:{},sources:[]}}/>
  </AppShell>;
}
