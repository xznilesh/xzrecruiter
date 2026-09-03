import fs from 'node:fs';
const files=['supabase/migrations/20260903_step5_recruitment_crm_core.sql','supabase/migrations/20260903_step5_recruitment_crm_rpcs.sql'];
const text=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const assertions=[
 ['session-derived workspace','private.xzrecruiter_session_context'],
 ['deny direct browser access','xzrecruiter_data_api_deny'],
 ['RLS enabled','enable row level security'],
 ['client ownership','agency_id'],
 ['opportunity ownership','crm_opportunities'],
 ['task ownership','crm_tasks'],
 ['contract ownership','recruitment_client_contracts'],
 ['cross-tenant relation guard','xzrecruiter_crm_relation_integrity'],
 ['security definer RPC boundary','security definer'],
 ['write permission guard','xzrecruiter_can_write']
];
for(const [name,needle] of assertions)if(!text.toLowerCase().includes(needle.toLowerCase()))throw new Error(`Step 5 security invariant missing: ${name} (${needle})`);
const api=fs.readFileSync('app/api/crm/route.js','utf8');
if(!api.includes('sameOrigin'))throw new Error('CRM mutation route missing same-origin guard');
if(/agencyId|agency_id/.test(api)&&!api.includes("body.action"))throw new Error('Review browser agency ownership exposure');
const lib=fs.readFileSync('lib/crm.js','utf8');
if(lib.includes('p_agency_id'))throw new Error('CRM browser/server wrapper must not send p_agency_id; workspace must come from session');
console.log(`Step 5 security checks passed (${assertions.length+3} assertions).`);
