import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const must=(p)=>assert.ok(fs.existsSync(path.join(root,p)),`Missing ${p}`);

for(const p of ['app/onboarding/page.js','app/api/onboarding/route.js','app/api/config/route.js','app/api/import/route.js','app/components/OnboardingWizard.js','app/components/SettingsCenter.js','lib/workspace-ready.js','supabase/migrations/20260903_step3_agency_onboarding_core.sql','supabase/migrations/20260903_step3_agency_onboarding_rpcs.sql'])must(p);

const guard=read('lib/workspace-ready.js');
const dashboard=read('app/dashboard/page.js');
const onboarding=read('app/api/onboarding/route.js');
const config=read('app/api/config/route.js');
const importer=read('app/api/import/route.js');
const core=read('supabase/migrations/20260903_step3_agency_onboarding_core.sql');
const rpcs=read('supabase/migrations/20260903_step3_agency_onboarding_rpcs.sql');

assert.ok(guard.includes("progress?.status !== 'COMPLETED'")&&guard.includes("redirect('/onboarding')"),'Incomplete onboarding must be server-gated');
assert.ok(dashboard.includes('requireReadyWorkspace'),'Dashboard must use server onboarding guard');
assert.ok(onboarding.includes('sameOrigin')&&onboarding.includes('xzrecruiter_save_onboarding_section'));
for(const action of ['pipeline','customField','savedView','territory','customTaxonomy'])assert.ok(config.includes(action),`Missing config action ${action}`);
assert.ok(importer.includes('rows.length > 1000')&&importer.includes('xzrecruiter_stage_import')&&importer.includes('xzrecruiter_commit_import'));
for(const table of ['onboarding_progress','agency_operating_profiles','agency_market_targets','recruitment_pipelines','pipeline_stages','custom_field_definitions','saved_views','workspace_territories','import_batches'])assert.ok(core.includes(`public.${table}`),`Missing Step-3 table ${table}`);
assert.ok(rpcs.includes('private.xzrecruiter_session_context'));
assert.ok(!/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i.test(`${core}\n${rpcs}`),'Step 3 must stay additive/non-destructive');

console.log('XZ Recruiter Step-3 regression verification passed.');
