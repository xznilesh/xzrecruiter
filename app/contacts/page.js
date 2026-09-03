import AppShell from '@/app/components/AppShell';
import CrmWorkspace from '@/app/components/CrmWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getCrmReferenceContext,getCrmSearch,getCrmSavedViews } from '@/lib/crm';

export const dynamic='force-dynamic';
export default async function ContactsPage({searchParams}){
 const params=await searchParams;const {user,globalContext}=await requireReadyWorkspace();const page=Math.max(1,Number(params?.page||1));const limit=50;
 const filters={clientId:String(params?.client||''),roleType:String(params?.role||''),status:String(params?.status||'')};
 const [context,reference,savedViews,accounts]=await Promise.all([getCrmSearch('CONTACT',String(params?.q||''),filters,limit,(page-1)*limit),getCrmReferenceContext(),getCrmSavedViews('CRM_CONTACT'),getCrmSearch('CLIENT','',{},100,0)]);
 return <AppShell user={user} globalSettings={globalContext.settings} active="contacts"><div className="page-heading"><div><span className="page-kicker">Agency business</span><h1>Contacts</h1><p>Decision makers, hiring managers and commercial stakeholders connected directly to client and opportunity context.</p></div><span className="status good">● Relationship ready</span></div><CrmWorkspace module="CONTACT" context={context||{rows:[],total:0,limit,offset:0}} reference={reference||{}} countries={globalContext.countries||[]} timezones={globalContext.timezones||[]} savedViews={savedViews} accountOptions={accounts?.rows||[]}/></AppShell>;
}
