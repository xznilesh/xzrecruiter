import AppShell from '@/app/components/AppShell';
import RecruitmentOpsWorkspace from '@/app/components/RecruitmentOpsWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getAtsContext } from '@/lib/ats';

export const dynamic='force-dynamic';

export default async function InterviewsPage(){
  const {user,globalContext}=await requireReadyWorkspace();
  const [context,pipeline]=await Promise.all([getAtsContext('INTERVIEWS','',100,0),getAtsContext('PIPELINE','',100,0)]);
  return <AppShell user={user} globalSettings={globalContext.settings} active="interviews"><div className="page-heading"><div><span className="page-kicker">Recruitment</span><h1>Interviews</h1><p>Timezone-safe scheduling with candidate/job context carried forward automatically.</p></div><span className="status good">● IANA timezone aware</span></div><RecruitmentOpsWorkspace module="INTERVIEWS" context={context||{rows:[],total:0}} applications={pipeline?.rows||[]} timezones={globalContext.timezones||[]} defaultTimezone={globalContext.settings?.timezone_id||'UTC'} defaultCurrency={globalContext.settings?.currency_code||'USD'}/></AppShell>;
}
