import { redirect } from 'next/navigation';
import AppShell from '@/app/components/AppShell';
import OfficeSettings from '@/app/components/OfficeSettings';
import { getCurrentUser } from '@/lib/auth';
import { getGlobalContext } from '@/lib/global-context';
import { getOfficeContext } from '@/lib/offices';

export const dynamic='force-dynamic';

export default async function OfficesPage(){
  const user=await getCurrentUser();
  if(!user) redirect('/login');
  const [globalContext,officeContext]=await Promise.all([getGlobalContext().catch(()=>null),getOfficeContext().catch(()=>null)]);
  if(!globalContext?.settings||!officeContext) redirect('/settings?error=offices');
  return <AppShell user={user} globalSettings={globalContext.settings} active="settings"><div className="page-heading"><div><span className="page-kicker">Configuration Center</span><h1>Offices</h1><p>Manage a global recruiting operation without mixing timezones between countries or offices.</p></div></div><OfficeSettings globalContext={globalContext} officeContext={officeContext}/></AppShell>;
}
