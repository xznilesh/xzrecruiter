import AppShell from '@/app/components/AppShell';
import RecruitmentOpsWorkspace from '@/app/components/RecruitmentOpsWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getAtsContext } from '@/lib/ats';

export const dynamic='force-dynamic';

export default async function PlacementsPage(){
  const {user,globalContext}=await requireReadyWorkspace();
  const [context,pipeline]=await Promise.all([getAtsContext('PLACEMENTS','',100,0),getAtsContext('PIPELINE','',100,0)]);
  return <AppShell user={user} globalSettings={globalContext.settings} active="placements"><div className="page-heading"><div><span className="page-kicker">Recruitment</span><h1>Placements</h1><p>Durable hire records with fee, commission and original-currency foundations.</p></div><span className="status good">● Revenue-ready records</span></div><RecruitmentOpsWorkspace module="PLACEMENTS" context={context||{rows:[],total:0}} applications={pipeline?.rows||[]} timezones={globalContext.timezones||[]} defaultTimezone={globalContext.settings?.timezone_id||'UTC'} defaultCurrency={globalContext.settings?.currency_code||'USD'}/></AppShell>;
}
