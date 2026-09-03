import fs from 'node:fs';
const exists=p=>{if(!fs.existsSync(p))throw new Error(`missing ${p}`);return fs.readFileSync(p,'utf8')};
const portalSql=exists('supabase/migrations/20260903_step5_client_vendor_portals.sql');
const vendorResume=exists('supabase/migrations/20260903_step5_vendor_private_resume.sql');
const files=[
 'app/components/ClientPortalWorkspace.js','app/components/VendorPortalWorkspace.js','app/components/PortalManagerWorkspace.js',
 'app/api/public/client-portal/feedback/route.js','app/api/public/vendor-portal/submit/route.js','app/api/public/vendor-portal/resume/route.js'
];
files.forEach(exists);
const requirements=[
 ['client portal token','xzrecruiter_client_portal'],['client feedback','xzrecruiter_client_portal_feedback'],
 ['vendor portal','xzrecruiter_vendor_portal'],['vendor submission','xzrecruiter_vendor_portal_submit'],
 ['vendor sharing','vendor_job_access'],['portal expiry','expires_at'],['token hashing','token_hash']
];
for(const [label,needle] of requirements)if(!portalSql.toLowerCase().includes(needle.toLowerCase()))throw new Error(`Portal requirement missing: ${label}`);
if(!vendorResume.includes('vendor_candidate_submissions'))throw new Error('Vendor resume migration missing submission binding');
const vendorUi=exists('app/components/VendorPortalWorkspace.js');
if(!vendorUi.includes('Candidate submission')||!vendorUi.includes('Shared requirements'))throw new Error('Vendor portal workflow incomplete');
const clientUi=exists('app/components/ClientPortalWorkspace.js');
if(!/feedback|decision/i.test(clientUi))throw new Error('Client portal feedback workflow incomplete');
console.log(`Step 5 portal regression checks passed (${files.length+requirements.length+3} assertions).`);
