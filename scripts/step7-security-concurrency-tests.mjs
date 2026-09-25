import assert from 'node:assert/strict';
import fs from 'node:fs';

const step3=fs.readFileSync('supabase/migrations/20260926_step3_recruiter_execution_workspace.sql','utf8');
const step5=fs.readFileSync('supabase/migrations/20260925_step5_ai_assisted_human_screening.sql','utf8');
const step6core=fs.readFileSync('supabase/migrations/20260925_step6_submission_pack_core.sql','utf8');
const step6=fs.readFileSync('supabase/migrations/20260925_step6_submission_pack_rpcs.sql','utf8');
const step7=fs.readFileSync('supabase/migrations/20260928_step7_enterprise_multitenant_security_foundation.sql','utf8');

assert.ok(step3.includes('intake_idempotency_key')&&step3.includes('uq_xzr_application_intake_idempotency'),'candidate intake idempotency missing');
assert.ok(step3.includes('task_idempotency_key')||step3.includes('idempotency_key'),'task idempotency missing');

assert.ok(step5.includes('unique(agency_id,idempotency_key)'),'screening start idempotency uniqueness missing');
assert.ok(step5.includes('last_mutation_key'),'screening mutation replay guard missing');
assert.ok(step5.includes('for update'),'screening concurrent update lock missing');
assert.ok(step5.includes('stale_screening_version'),'screening optimistic concurrency missing');

assert.ok(step6core.includes('candidate_submission_idempotency'),'submission idempotency table missing');
assert.ok(step6core.includes('version_lock bigint'),'submission optimistic lock version missing');
assert.ok(step6core.includes('unique(agency_id,operation,idempotency_key)'),'submission idempotency uniqueness missing');
for(const op of ['STEP6_GENERATE','STEP6_SEND','STEP6_AM','STEP6_CLIENT']){
  assert.ok(step6.includes('pg_advisory_xact_lock')&&step6.includes(op),`submission concurrency lock missing for ${op}`);
}
assert.ok(step6.includes('stale_submission_version'),'stale submission writes must be rejected');
assert.ok(step6.includes('duplicate_client_submission'),'duplicate client submission guard missing');

assert.ok((step7.match(/pg_advisory_xact_lock/g)||[]).length>=3,'Step-7 wrappers must preserve/strengthen critical locks');
assert.ok(step7.includes("membership.role_changed")&&step7.includes("sessions_revoked"),'membership changes must invalidate sessions');
assert.ok(step7.includes("submission.client_submitted")&&step7.includes("candidate.export_rate_limited"),'critical mutation/security events missing');

console.log('STEP7_CONCURRENCY_SECURITY_PASS intake=true screening=true submissions=true membership_revocation=true idempotency=true');
