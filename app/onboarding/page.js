import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getGlobalContext } from '@/lib/global-context';
import { getOnboardingContext } from '@/lib/onboarding';
import OnboardingWizard from '@/app/components/OnboardingWizard';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage({ searchParams }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [globalContext, onboarding] = await Promise.all([
    getGlobalContext().catch(() => null),
    getOnboardingContext().catch(() => null)
  ]);
  if (!globalContext?.settings || !onboarding) redirect('/dashboard?error=setup');
  if (onboarding.progress?.status === 'COMPLETED' && params?.edit !== '1' && !params?.section) redirect('/dashboard');

  return <OnboardingWizard
    user={user}
    globalContext={globalContext}
    onboarding={onboarding}
    initialSection={String(params?.section || onboarding.progress?.current_step || 'profile')}
    editMode={params?.edit === '1' || onboarding.progress?.status === 'COMPLETED'}
  />;
}
