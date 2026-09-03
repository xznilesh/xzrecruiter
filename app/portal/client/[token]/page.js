import { notFound } from 'next/navigation';
import Brand from '@/app/components/Brand';
import ClientPortalWorkspace from '@/app/components/ClientPortalWorkspace';
import { rpc } from '@/lib/supabase-api';

export const dynamic='force-dynamic';
export default async function ClientPortalPage({params}){
 const {token}=await params;const result=await rpc('xzrecruiter_client_portal_snapshot',{p_portal_token:token}).catch(()=>null);if(!result?.ok)notFound();
 return <div className="external-portal-page"><div className="external-portal-brand"><Brand/></div><ClientPortalWorkspace token={token} snapshot={result}/><footer className="external-portal-footer">Secure collaboration portal · XZ Recruiter</footer></div>;
}
