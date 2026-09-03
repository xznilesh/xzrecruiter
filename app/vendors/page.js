import AppShell from '@/app/components/AppShell';
import VendorWorkspace from '@/app/components/VendorWorkspace';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getVendorContext,getCrmReferenceContext } from '@/lib/crm';
import { getJobSearch } from '@/lib/ats';

export const dynamic='force-dynamic';
export default async function VendorsPage({searchParams}){
 const params=await searchParams;const {user,globalContext}=await requireReadyWorkspace();const page=Math.max(1,Number(params?.page||1));const limit=50;
 const [context,reference,jobs]=await Promise.all([getVendorContext(String(params?.q||''),limit,(page-1)*limit),getCrmReferenceContext(),getJobSearch('',{status:'OPEN'},100,0)]);
 return <AppShell user={user} globalSettings={globalContext.settings} active="vendors"><div className="page-heading"><div><span className="page-kicker">Agency network</span><h1>Vendors & Partners</h1><p>Manage sourcing partners, share selected jobs securely and receive vendor candidate submissions without exposing the workspace.</p></div><span className="status good">● Controlled collaboration</span></div><VendorWorkspace context={context||{rows:[],total:0,limit,offset:0}} reference={reference||{}} countries={globalContext.countries||[]} timezones={globalContext.timezones||[]} jobs={jobs?.rows||[]}/></AppShell>;
}
