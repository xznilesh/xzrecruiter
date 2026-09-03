import { sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

export async function getOnboardingContext() {
  const token = await sessionToken();
  if (!token) return null;
  const result = await rpc('xzrecruiter_onboarding_context', { p_token: token });
  return result?.ok ? result : null;
}

export async function saveOnboardingSection(section, payload, markComplete = false) {
  const token = await sessionToken();
  if (!token) return { ok: false, error: 'unauthorized' };
  return rpc('xzrecruiter_save_onboarding_section', {
    p_token: token,
    p_section: section,
    p_payload: payload || {},
    p_mark_complete: !!markComplete
  });
}

export async function completeOnboarding() {
  const token = await sessionToken();
  if (!token) return { ok: false, error: 'unauthorized' };
  return rpc('xzrecruiter_complete_onboarding', { p_token: token });
}
