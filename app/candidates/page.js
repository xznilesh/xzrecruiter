import AppShell from '@/app/components/AppShell';
import CandidateWorkspace from '@/app/components/CandidateWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getCandidateSearch } from '@/lib/ats';

export const dynamic='force-dynamic';

export default async function CandidatesPage({searchParams}){
  const params=await searchParams;
  const {user,globalContext}=await requireReadyWorkspace();
  const page=Math.max(1,Number(params?.page||1));
  const limit=50;
  const filters={
    countryCode:String(params?.country||''),
    availability:String(params?.availability||''),
    workplace:String(params?.workplace||''),
    skill:String(params?.skill||''),
    maxNoticeDays:String(params?.notice||'')
  };
  const context=await getCandidateSearch(String(params?.q||''),filters,limit,(page-1)*limit);
  return <AppShell user={user} globalSettings={globalContext.settings} active="candidates"><div className="page-heading"><div><span className="page-kicker">Recruitment</span><h1>Candidates</h1><p>Candidate 360 with private resume parsing, duplicate review, bulk actions and server-side filters.</p></div><span className="status good">● Workspace isolated</span></div><CandidateWorkspace context={context||{rows:[],total:0,limit,offset:0}} countries={globalContext.countries||[]} timezones={globalContext.timezones||[]}/></AppShell>;
}
