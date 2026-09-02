import { redirect } from 'next/navigation';
import AppShell from '@/app/components/AppShell';
import SettingsCenter from '@/app/components/SettingsCenter';
import { getCurrentUser } from '@/lib/auth';
import { getGlobalContext } from '@/lib/global-context';
import { getOnboardingContext } from '@/lib/onboarding';

export const dynamic='force-dynamic';

export default async function SettingsPage({ searchParams }) {
  const params=await searchParams;
  const user=await getCurrentUser();
  if(!user) redirect('/login');
  const [globalContext,onboarding]=await Promise.all([getGlobalContext().catch(()=>null),getOnboardingContext().catch(()=>null)]);
  if(!globalContext?.settings||!onboarding) redirect('/dashboard?error=settings');
  return <AppShell user={user} globalSettings={globalContext.settings} active="settings"><SettingsCenter onboarding={onboarding} globalContext={globalContext} initialFocus={String(params?.focus||'')}/></AppShell>;
}
