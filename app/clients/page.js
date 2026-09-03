import AppShell from '@/app/components/AppShell';
import CrmWorkspace from '@/app/components/CrmWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getCrmReferenceContext,getCrmSearch,getCrmSavedViews } from '@/lib/crm';

export const dynamic='force-dynamic';
export default async function ClientsPage({searchParams}){
 const params=await searchParams;const {user,globalContext}=await requireReadyWorkspace();const page=Math.max(1,Number(params?.page||1));const limit=50;
 const filters={status:String(params?.status||''),countryCode:String(params?.country||''),health:String(params?.health||''),ownerId:String(params?.owner||'')};
 const [context,reference,savedViews]=await Promise.all([getCrmSearch('CLIENT',String(params?.q||''),filters,limit,(page-1)*limit),getCrmReferenceContext(),getCrmSavedViews('CRM_CLIENT')]);
 return <AppShell user={user} globalSettings={globalContext.settings} active="clients"><div className="page-heading"><div><span className="page-kicker">Agency business</span><h1>Clients & Accounts</h1><p>Prospects, active clients, commercial terms, recruitment footprint and relationship context in one 360° workspace.</p></div><span className="status good">● CRM + ATS connected</span></div><CrmWorkspace module="CLIENT" context={context||{rows:[],total:0,limit,offset:0}} reference={reference||{}} countries={globalContext.countries||[]} timezones={globalContext.timezones||[]} savedViews={savedViews}/></AppShell>;
}
