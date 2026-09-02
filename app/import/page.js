import { redirect } from 'next/navigation';
import AppShell from '@/app/components/AppShell';
import ImportWizard from '@/app/components/ImportWizard';
import { getCurrentUser } from '@/lib/auth';
import { getGlobalContext } from '@/lib/global-context';

export const dynamic = 'force-dynamic';

export default async function ImportPage({ searchParams }) {
  const params=await searchParams;
  const user=await getCurrentUser();
  if(!user) redirect('/login');
  const globalContext=await getGlobalContext().catch(()=>null);
  if(!globalContext?.settings) redirect('/dashboard?error=global');
  const returnTo=String(params?.return||'/settings');
  return <AppShell user={user} globalSettings={globalContext.settings} active="settings"><div className="page-heading"><div><span className="page-kicker">Safe data onboarding</span><h1>CSV Import</h1><p>Upload → map → preview → validate → explicitly import → review the report.</p></div></div><ImportWizard returnTo={returnTo}/></AppShell>;
}
