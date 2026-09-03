import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getGlobalContext } from '@/lib/global-context';
import { getOnboardingContext } from '@/lib/onboarding';

export async function requireReadyWorkspace() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const [globalContext, onboarding] = await Promise.all([
    getGlobalContext().catch(() => null),
    getOnboardingContext().catch(() => null)
  ]);
  if (!globalContext?.settings) redirect('/login?error=service');
  if (!onboarding || onboarding.progress?.status !== 'COMPLETED') redirect('/onboarding');
  return { user, globalContext, onboarding };
}
