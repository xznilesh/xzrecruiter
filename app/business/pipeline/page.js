import AppShell from '@/app/components/AppShell';
import BusinessPipelineWorkspace from '@/app/components/BusinessPipelineWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getBusinessPipeline,getCrmReferenceContext } from '@/lib/crm';

export const dynamic='force-dynamic';
export default async function BusinessPipelinePage(){
 const {user,globalContext}=await requireReadyWorkspace();const [context,reference]=await Promise.all([getBusinessPipeline(500),getCrmReferenceContext()]);
 return <AppShell user={user} globalSettings={globalContext.settings} active="business-pipeline"><div className="page-heading"><div><span className="page-kicker">Agency revenue</span><h1>Business Development Pipeline</h1><p>Target account → lead → conversation → client → requirement → placement, with weighted revenue and persistent stage history.</p></div><span className="status good">● Commercial workflow</span></div><BusinessPipelineWorkspace context={context||{stages:[],opportunities:[],summary:{}}} reference={reference||{}}/></AppShell>;
}
