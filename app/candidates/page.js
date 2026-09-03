import AppShell from '@/app/components/AppShell';
import CandidateWorkspace from '@/app/components/CandidateWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getAtsContext } from '@/lib/ats';

export const dynamic='force-dynamic';

export default async function CandidatesPage({searchParams}){
  const params=await searchParams;
  const {user,globalContext}=await requireReadyWorkspace();
  const context=await getAtsContext('CANDIDATES',String(params?.q||''),50,0);
  return <AppShell user={user} globalSettings={globalContext.settings} active="candidates"><div className="page-heading"><div><span className="page-kicker">Recruitment</span><h1>Candidates</h1><p>Fast Candidate 360, global compensation context and duplicate-safe capture.</p></div><span className="status good">● Workspace isolated</span></div><CandidateWorkspace context={context||{rows:[],total:0}} countries={globalContext.countries||[]} timezones={globalContext.timezones||[]}/></AppShell>;
}
