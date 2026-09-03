import { notFound } from 'next/navigation';
import Brand from '@/app/components/Brand';
import VendorPortalWorkspace from '@/app/components/VendorPortalWorkspace';
import { rpc } from '@/lib/supabase-api';

export const dynamic='force-dynamic';
export default async function VendorPortalPage({params}){
 const {token}=await params;const result=await rpc('xzrecruiter_vendor_portal_snapshot',{p_portal_token:token}).catch(()=>null);if(!result?.ok)notFound();
 return <div className="external-portal-page"><div className="external-portal-brand"><Brand/></div><VendorPortalWorkspace token={token} snapshot={result}/><footer className="external-portal-footer">Secure vendor collaboration · XZ Recruiter</footer></div>;
}
