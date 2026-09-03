import AppShell from '@/app/components/AppShell';
import CrmWorkspace from '@/app/components/CrmWorkspace';
import CrmQuickCreateOverlay from '@/app/components/CrmQuickCreateOverlay';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getCrmReferenceContext,getCrmSearch,getCrmSavedViews } from '@/lib/crm';

export const dynamic='force-dynamic';
export default async function TasksPage({searchParams}){
 const params=await searchParams;const {user,globalContext}=await requireReadyWorkspace();const page=Math.max(1,Number(params?.page||1));const limit=50;
 const filters={status:String(params?.status||''),priority:String(params?.priority||''),assignedUserId:String(params?.owner||''),due:String(params?.due||'')};
 const [context,reference,savedViews,accounts]=await Promise.all([getCrmSearch('TASK',String(params?.q||''),filters,limit,(page-1)*limit),getCrmReferenceContext(),getCrmSavedViews('CRM_TASK'),getCrmSearch('CLIENT','',{},100,0)]);
 return <AppShell user={user} globalSettings={globalContext.settings} active="tasks"><div className="page-heading"><div><span className="page-kicker">Productivity</span><h1>Tasks</h1><p>Account, contact and opportunity follow-ups in one prioritized action queue.</p></div><span className="status good">● Action focused</span></div><CrmWorkspace module="TASK" context={context||{rows:[],total:0,limit,offset:0}} reference={reference||{}} countries={globalContext.countries||[]} timezones={globalContext.timezones||[]} savedViews={savedViews} accountOptions={accounts?.rows||[]}/>{String(params?.action||'')==='create'?<CrmQuickCreateOverlay module="TASK" reference={reference||{}} accountOptions={accounts?.rows||[]} countries={globalContext.countries||[]} timezones={globalContext.timezones||[]}/>:null}</AppShell>;
}
