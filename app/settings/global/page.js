import { redirect } from 'next/navigation';
import AppShell from '@/app/components/AppShell';
import GlobalSettingsForm from '@/app/components/GlobalSettingsForm';
import { getCurrentUser } from '@/lib/auth';
import { getGlobalContext } from '@/lib/global-context';

export const dynamic = 'force-dynamic';

export default async function GlobalSettingsPage() {
  let user;
  try { user = await getCurrentUser(); }
  catch { redirect('/login?error=service'); }
  if (!user) redirect('/login');

  let context;
  try { context = await getGlobalContext(); }
  catch (error) { console.error('global_settings_context_failed', error?.message || ''); }
  if (!context) redirect('/login');

  const canEdit = ['OWNER','ADMIN'].includes(user.role);
  return <AppShell user={user} globalSettings={context.settings} active="settings">
    <div className="page-heading"><div><span className="page-kicker">Global foundation</span><h1>Workspace operating settings</h1><p>One persisted source of truth for locale, currency, language and timezone behavior across XZ Recruiter.</p></div><span className="status good">● {context.countries.filter((c) => c.certified).length} certified markets</span></div>
    <GlobalSettingsForm context={context} canEdit={canEdit} />
  </AppShell>;
}
