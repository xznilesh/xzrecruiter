import fs from 'node:fs';
const required = ['app/page.js','app/dashboard/page.js','app/api/health/ready/route.js','lib/db.js','lib/auth.js','public/xzrecruiter-logo.svg'];
const missing = required.filter((p) => !fs.existsSync(p));
if (missing.length) { console.error('Missing required files:', missing.join(', ')); process.exit(1); }
console.log('XZRecruiter source verification passed.');
