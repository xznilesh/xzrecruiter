import AppShell from '@/app/components/AppShell';
import RecruitmentOpsWorkspace from '@/app/components/RecruitmentOpsWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getAtsContext } from '@/lib/ats';

export const dynamic='force-dynamic';

export default async function OffersPage(){
  const {user,globalContext}=await requireReadyWorkspace();
  const [context,pipeline]=await Promise.all([getAtsContext('OFFERS','',100,0),getAtsContext('PIPELINE','',100,0)]);
  return <AppShell user={user} globalSettings={globalContext.settings} active="offers"><div className="page-heading"><div><span className="page-kicker">Recruitment</span><h1>Offers</h1><p>Version-safe offers with global compensation fields and approval-ready status.</p></div><span className="status good">● Version history preserved</span></div><RecruitmentOpsWorkspace module="OFFERS" context={context||{rows:[],total:0}} applications={pipeline?.rows||[]} timezones={globalContext.timezones||[]} defaultTimezone={globalContext.settings?.timezone_id||'UTC'} defaultCurrency={globalContext.settings?.currency_code||'USD'}/></AppShell>;
}
