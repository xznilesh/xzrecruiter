import AppShell from '@/app/components/AppShell';
import CrmWorkspace from '@/app/components/CrmWorkspace';
import CrmQuickCreateOverlay from '@/app/components/CrmQuickCreateOverlay';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getCrmReferenceContext,getCrmSearch,getCrmSavedViews } from '@/lib/crm';

export const dynamic='force-dynamic';
export default async function OpportunitiesPage({searchParams}){
 const params=await searchParams;const {user,globalContext}=await requireReadyWorkspace();const page=Math.max(1,Number(params?.page||1));const limit=50;
 const filters={status:String(params?.status||''),stageId:String(params?.stage||''),ownerId:String(params?.owner||'')};
 const [context,reference,savedViews,accounts]=await Promise.all([getCrmSearch('OPPORTUNITY',String(params?.q||''),filters,limit,(page-1)*limit),getCrmReferenceContext(),getCrmSavedViews('CRM_OPPORTUNITY'),getCrmSearch('CLIENT','',{},100,0)]);
 return <AppShell user={user} globalSettings={globalContext.settings} active="opportunities"><div className="page-heading"><div><span className="page-kicker">Agency business</span><h1>Opportunities</h1><p>Turn prospects into commercial opportunities with stage history, weighted revenue, owners, follow-ups and ATS-connected delivery context.</p></div><span className="status good">● Revenue pipeline</span></div><CrmWorkspace module="OPPORTUNITY" context={context||{rows:[],total:0,limit,offset:0}} reference={reference||{}} countries={globalContext.countries||[]} timezones={globalContext.timezones||[]} savedViews={savedViews} accountOptions={accounts?.rows||[]}/>{String(params?.action||'')==='create'?<CrmQuickCreateOverlay module="OPPORTUNITY" reference={reference||{}} accountOptions={accounts?.rows||[]} countries={globalContext.countries||[]} timezones={globalContext.timezones||[]}/>:null}</AppShell>;
}
