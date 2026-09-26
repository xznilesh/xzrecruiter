import AppShell from '@/app/components/AppShell';
import AutomationNotificationCenter from '@/app/components/AutomationNotificationCenter';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getAutomationNotifications } from '@/lib/manager-control-server';

export const dynamic='force-dynamic';

export default async function NotificationsPage(){
  const {user,globalContext}=await requireReadyWorkspace();
  const data=await getAutomationNotifications(100).catch(()=>({ok:false,notifications:[]}));
  return <AppShell user={user} globalSettings={globalContext.settings} active="automation-notifications">
    <AutomationNotificationCenter initialData={data||{notifications:[]}}/>
  </AppShell>;
}
