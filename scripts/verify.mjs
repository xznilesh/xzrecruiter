import fs from 'node:fs';
const required = [
  'app/page.js',
  'app/dashboard/page.js',
  'app/login/page.js',
  'app/signup/page.js',
  'app/verify-email/page.js',
  'app/reset-password/page.js',
  'app/components/Brand.js',
  'app/api/auth/verify-email/route.js',
  'app/api/auth/password-reset/request/route.js',
  'app/api/auth/password-reset/complete/route.js',
  'app/api/health/ready/route.js',
  'lib/db.js',
  'lib/auth.js',
  'public/xzrecruiter-logo.svg',
  'supabase/migrations/20260903_step1_foundation_security_branding.sql'
];
const missing = required.filter((p) => !fs.existsSync(p));
if (missing.length) { console.error('Missing required files:', missing.join(', ')); process.exit(1); }
console.log('XZ Recruiter Step-1 source verification passed.');
