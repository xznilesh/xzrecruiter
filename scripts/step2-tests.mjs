import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const importSource = async (p) => import(`data:text/javascript;base64,${Buffer.from(read(p)).toString('base64')}`);
const g = await importSource('lib/globalization.js');
const i18n = await importSource('i18n/resources.js');
const fixtures = JSON.parse(read('tests/fixtures/global-markets.json'));
const migration = read('supabase/migrations/20260903_step2_global_operating_foundation.sql');
const css = read('app/foundation.css');
const shell = read('app/components/AppShell.js');
const table = read('app/components/EnterpriseTable.js');
const auth = read('lib/auth.js');
const signup = read('app/api/auth/signup/route.js');
const logo = read('public/xzrecruiter-logo.svg');

function hm(timeZone, iso) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

// Representative country fixtures and IANA validity.
assert.equal(fixtures.length, 14);
for (const fixture of fixtures) {
  assert.match(fixture.country, /^[A-Z]{2}$/);
  assert.match(fixture.currency, /^[A-Z]{3}$/);
  assert.doesNotThrow(() => g.assertIanaTimezone(fixture.timezone), fixture.label);
  assert.doesNotThrow(() => new Intl.Locale(fixture.locale), fixture.locale);
}
assert.throws(() => g.assertIanaTimezone('UTC+10'));

// Certified market architecture: all priority markets are seeded as data, not columns.
const certified = ['IN','US','CA','GB','DE','FR','IT','NL','ES','IE','CH','SE','DK','NO','AE','SA','QA','BH','KW','OM','SG','AU','NZ'];
for (const code of certified) assert.ok(migration.includes(`('${code}',`), `Missing certified market ${code}`);
assert.ok(!/country_usa|timezone_india|currency_uk/i.test(migration));

// Locale-sensitive dates.
const date = '2026-09-03T12:30:00Z';
assert.equal(g.formatNumericDate(date, { locale: 'en-US', timezone: 'America/New_York' }), '09/03/2026');
assert.equal(g.formatNumericDate(date, { locale: 'en-GB', timezone: 'Europe/London' }), '03/09/2026');
assert.equal(g.formatNumericDate(date, { locale: 'de-DE', timezone: 'Europe/Berlin' }), '03.09.2026');
assert.equal(g.formatNumericDate(date, { locale: 'en-IN', timezone: 'Asia/Kolkata' }), '03/09/2026');

// Currency + salary source formatting (display only, original ISO currency retained).
assert.equal(g.formatCurrency(1800000, 'INR', 'en-IN'), '₹18,00,000');
assert.equal(g.formatCurrency(120000, 'USD', 'en-US'), '$120,000');
assert.equal(g.formatCurrency(70000, 'GBP', 'en-GB'), '£70,000');
const deSalary = g.formatCurrency(75000, 'EUR', 'de-DE');
assert.ok(deSalary.includes('75.000') && deSalary.includes('€'));
const uaeSalary = g.formatSalary({ min: 18000, currency: 'AED', period: 'MONTHLY', locale: 'en-AE' });
assert.ok(uaeSalary.includes('AED') && uaeSalary.includes('18,000') && uaeSalary.includes('per month'));

// Critical cross-timezone summer example: London 10:00 = India 14:30 = Dubai 13:00.
const summerMeeting = '2026-07-15T09:00:00Z';
assert.equal(hm('Europe/London', summerMeeting), '10:00');
assert.equal(hm('Asia/Kolkata', summerMeeting), '14:30');
assert.equal(hm('Asia/Dubai', summerMeeting), '13:00');

// US DST: same New York wall clock uses different UTC instants in winter and summer.
assert.equal(hm('America/New_York', '2026-01-15T15:00:00Z'), '10:00');
assert.equal(hm('America/New_York', '2026-07-15T14:00:00Z'), '10:00');
assert.equal(hm('America/Los_Angeles', '2026-07-15T17:00:00Z'), '10:00');

// Europe DST.
assert.equal(hm('Europe/London', '2026-01-15T10:00:00Z'), '10:00');
assert.equal(hm('Europe/London', '2026-07-15T09:00:00Z'), '10:00');
assert.equal(hm('Europe/Berlin', '2026-01-15T09:00:00Z'), '10:00');
assert.equal(hm('Europe/Berlin', '2026-07-15T08:00:00Z'), '10:00');

// Australia must never collapse to one timezone. Sydney DST differs from Brisbane and Perth.
assert.equal(hm('Australia/Sydney', '2026-01-15T00:00:00Z'), '11:00');
assert.equal(hm('Australia/Brisbane', '2026-01-15T00:00:00Z'), '10:00');
assert.equal(hm('Australia/Perth', '2026-01-15T00:00:00Z'), '08:00');
assert.equal(hm('Australia/Sydney', '2026-07-15T00:00:00Z'), '10:00');
assert.equal(hm('Australia/Perth', '2026-07-15T00:00:00Z'), '08:00');

// New Zealand Chatham quarter-hour zone.
assert.equal(hm('Pacific/Auckland', '2026-01-15T00:00:00Z'), '13:00');
assert.equal(hm('Pacific/Chatham', '2026-01-15T00:00:00Z'), '13:45');

// Arabic / RTL resource architecture and mixed-content safety.
assert.equal(g.directionFor('ar-SA'), 'rtl');
assert.equal(g.directionFor('en-AE'), 'ltr');
assert.equal(i18n.resources.ar.shell.home, 'الرئيسية');
assert.ok(i18n.resources.ar.settings.timezone.length > 2);
assert.equal(i18n.translate('ar', 'common', 'save'), 'حفظ التغييرات');

// Non-destructive and tenant-aware migration architecture.
assert.ok(!/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i.test(migration));
for (const owned of ['workspace_global_settings','workspace_markets','recruitment_offices','user_global_preferences','workspace_addresses','compensation_packages','work_authorizations']) {
  const start = migration.indexOf(`create table if not exists public.${owned}`);
  assert.ok(start >= 0, `Missing ${owned}`);
  assert.ok(migration.slice(start, start + 900).includes('agency_id'), `${owned} missing agency ownership`);
}
assert.ok(migration.includes('enable row level security'));
assert.ok(migration.includes('xzrecruiter_update_global_settings'));
assert.ok(migration.includes("v_role not in ('OWNER','ADMIN')"));

// Step 1 regression invariants remain in source.
assert.ok(auth.includes("'__Host-xz_session'"));
assert.ok(auth.includes("httpOnly: true"));
assert.ok(auth.includes("sameSite: 'lax'"));
assert.ok(signup.includes('requires_email_verification'));
assert.ok(fs.existsSync(path.join(root, 'app/api/auth/password-reset/complete/route.js')));
assert.ok(fs.existsSync(path.join(root, 'app/api/auth/verify-email/route.js')));
assert.ok(!logo.includes('>XZ</text>'), 'Duplicate XZ wordmark returned');
assert.ok(logo.includes('>Recruiter</text>'));

// Navigation, fast-action and large-list architecture.
assert.ok(shell.includes("href: '/dashboard'"));
assert.ok(shell.includes("href: '/settings/global'"));
assert.ok(!shell.includes("href: '#'"));
assert.ok(shell.includes('CommandPalette'));
assert.ok(table.includes('serverMode'));
assert.ok(table.includes('onQueryChange'));
assert.ok(table.includes('pageSize'));
assert.ok(table.includes('savedViews'));

// Responsive/static mobile gates and accessibility motion preferences.
for (const token of ['@media(max-width:900px)','@media(max-width:480px)','.xz-mobile-nav','overflow-x:hidden','prefers-reduced-motion']) assert.ok(css.includes(token), `Missing CSS gate ${token}`);
assert.ok(css.includes('min-width:680px') && css.includes('.table-scroll{overflow:auto'));

console.log(`STEP2_QA_PASS fixtures=${fixtures.length} certified_markets=${certified.length} dst=US+EU+AU+NZ rtl=ar security=preserved`);
