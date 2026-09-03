import AppShell from '@/app/components/AppShell';
import PipelineWorkspace from '@/app/components/PipelineWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getAtsContext } from '@/lib/ats';

export const dynamic='force-dynamic';

export default async function PipelinePage(){
  const {user,globalContext}=await requireReadyWorkspace();
  const [context,candidateContext,jobContext]=await Promise.all([
    getAtsContext('PIPELINE','',100,0),
    getAtsContext('CANDIDATES','',100,0),
    getAtsContext('JOBS','',100,0)
  ]);
  return <AppShell user={user} globalSettings={globalContext.settings} active="pipeline"><div className="page-heading"><div><span className="page-kicker">Recruitment</span><h1>Pipeline</h1><p>Independent candidate-to-job stages with server-persisted transitions and refresh-safe status.</p></div><span className="status good">● Live workflow</span></div><PipelineWorkspace context={context||{rows:[],total:0,meta:{pipelines:[]}}} candidates={candidateContext?.rows||[]} jobs={jobContext?.rows||[]}/></AppShell>;
}
