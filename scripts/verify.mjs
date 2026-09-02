import fs from 'node:fs';
const required = [
  'app/page.js','app/dashboard/page.js','app/login/page.js','app/signup/page.js','app/verify-email/page.js','app/reset-password/page.js',
  'app/settings/global/page.js','app/components/Brand.js','app/components/AppShell.js','app/components/CommandPalette.js',
  'app/components/EnterpriseTable.js','app/components/FormControls.js','app/components/DetailDrawer.js','app/components/ContextActionBar.js','app/components/GlobalSettingsForm.js',
  'app/api/settings/global/route.js','app/api/auth/verify-email/route.js','app/api/auth/password-reset/request/route.js','app/api/auth/password-reset/complete/route.js','app/api/health/ready/route.js',
  'lib/db.js','lib/auth.js','lib/globalization.js','lib/global-context.js','i18n/resources.js','public/xzrecruiter-logo.svg',
  'tests/fixtures/global-markets.json','scripts/step2-tests.mjs',
  'supabase/migrations/20260903_step1_foundation_security_branding.sql','supabase/migrations/20260903_step1_workspace_session_binding.sql',
  'supabase/migrations/20260903_step2_global_operating_foundation.sql'
];
const missing = required.filter((p) => !fs.existsSync(p));
if (missing.length) { console.error('Missing required files:', missing.join(', ')); process.exit(1); }

const auth = fs.readFileSync('lib/auth.js','utf8');
const logo = fs.readFileSync('public/xzrecruiter-logo.svg','utf8');
const migration = fs.readFileSync('supabase/migrations/20260903_step2_global_operating_foundation.sql','utf8');
if (!auth.includes('__Host-xz_session')) throw new Error('Secure Step-1 session cookie invariant missing');
if (logo.includes('>XZ</text>') || !logo.includes('>Recruiter</text>')) throw new Error('XZ Recruiter brand invariant failed');
if (/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i.test(migration)) throw new Error('Destructive Step-2 migration statement detected');
if (!migration.includes('workspace_global_settings') || !migration.includes('global_timezones')) throw new Error('Persisted globalization schema missing');
console.log('XZ Recruiter Step-1 + Step-2 source verification passed.');
