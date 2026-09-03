import AppShell from '@/app/components/AppShell';
import PortalManager from '@/app/components/PortalManager';
import { requireReadyWorkspace } from '@/lib/workspace-ready';
import { getCrmSearch,getVendorContext } from '@/lib/crm';

export const dynamic='force-dynamic';
export default async function PortalsPage(){
 const {user,globalContext}=await requireReadyWorkspace();const [clients,vendors]=await Promise.all([getCrmSearch('CLIENT','',{},100,0),getVendorContext('',100,0)]);
 return <AppShell user={user} globalSettings={globalContext.settings} active="portals"><div className="page-heading"><div><span className="page-kicker">Collaboration</span><h1>Client & Vendor Portals</h1><p>Issue secure external collaboration links without giving clients or partners access to the internal recruiter workspace.</p></div><span className="status good">● Token isolated</span></div><PortalManager clients={clients?.rows||[]} vendors={vendors?.rows||[]}/></AppShell>;
}
