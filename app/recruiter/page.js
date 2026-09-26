import AppShell from '@/app/components/AppShell';
import RecruiterCommandCenter from '@/app/components/RecruiterCommandCenter';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getRecruiterHome } from '@/lib/recruiter';

export const dynamic='force-dynamic';

export default async function RecruiterHomePage(){
  const {user,globalContext}=await requireReadyWorkspace();
  const context=await getRecruiterHome(50).catch(()=>null);
  return <AppShell user={user} globalSettings={globalContext.settings} active="recruiter-work">
    <div className="page-heading">
      <div><span className="page-kicker">Recruiter execution</span><h1>Today</h1><p>Your assigned roles, target gap, due actions and next operational work—without ATS busywork.</p></div>
      <span className="status neutral">{context?.timezone||globalContext.settings?.timezone_id||'UTC'}</span>
    </div>
    <RecruiterCommandCenter initialContext={context||{ok:false,error:'workspace_unavailable'}}/>
  </AppShell>;
}
