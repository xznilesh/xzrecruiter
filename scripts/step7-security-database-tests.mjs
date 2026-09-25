import assert from 'node:assert/strict';
import fs from 'node:fs';

const s=fs.readFileSync('supabase/migrations/20260928_step7_enterprise_multitenant_security_foundation.sql','utf8');

for(const token of [
  "u.disabled_at is null",
  "am.active=true",
  "s.revoked_at is null",
  "s.expires_at>now()",
  "alter default privileges in schema public revoke select,insert,update,delete on tables from anon,authenticated",
  "alter default privileges in schema public revoke execute on functions from public,anon,authenticated",
  "revoke select,insert,update,delete on all tables in schema public from anon,authenticated",
  "create policy xzrecruiter_data_api_deny",
  "alter view %I.%I set (security_invoker=true)",
  "xzrecruiter_membership_session_guard",
  "xzrecruiter_disabled_user_session_guard",
  "security_events",
  "organization_data_governance",
  "security_rate_limits",
  "document.sensitive_access",
  "candidate.export_denied",
  "commercial.read_denied",
  "submission.am_review_denied",
  "submission.client_submit_denied",
  "workspace_invitations_business_role_check",
  "workspace_invitations_owner_escalation_check",
  "j.recruiter_ready=true",
  "j.requirement_state='OPEN'",
  "j.approved_hiring_brief_id is not null"
]) assert.ok(s.includes(token),`missing Step-7 DB security control: ${token}`);

for(const table of [
  'candidate_documents','recruitment_attachments','requirement_jd_sources','requirement_hiring_briefs',
  'candidate_submissions','application_screening_sessions','application_screening_answers',
  'candidate_fact_assertions','candidate_submission_versions'
]) {
  assert.ok(s.includes(`alter table public.${table}`)&&s.includes('data_classification'),`classification missing for ${table}`);
}
for(const level of ['PUBLIC_LOW','INTERNAL','CONFIDENTIAL','HIGHLY_SENSITIVE'])assert.ok(s.includes(level));

assert.ok(s.includes("grant execute on function public.xzrecruiter_consume_rate_limit")&&s.includes("to service_role"),'rate limiter RPC must be service-role only');
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+all\s+tables\s+in\s+schema\s+public\s+to\s+(anon|authenticated)/i.test(s),'Step 7 must not restore broad direct table grants');
assert.ok(s.includes("revoke update,delete on public.audit_events,public.security_events from anon,authenticated"),'audit/security events must be immutable to ordinary API roles');

const definerChunks=s.split(/create or replace function/i).slice(1);
for(const chunk of definerChunks){
  if(!/security definer/i.test(chunk))continue;
  assert.ok(/set search_path=/i.test(chunk.slice(0,2500)),'every Step-7 SECURITY DEFINER function needs an explicit search_path');
}

const permissionPairs=[
  ['RECRUITMENT_MANAGER','candidate:screen'],
  ['ACCOUNT_MANAGER','submission:am_review'],
  ['ACCOUNT_MANAGER','commercial:edit'],
  ['RECRUITER','submission:create'],
  ['COMPLIANCE_REVIEWER','document:sensitive_view'],
];
for(const [role,permission] of permissionPairs){
  const start=s.indexOf(`when '${role}'`);
  assert.ok(start>=0&&s.slice(start,start+1000).includes(permission),`permission mapping drift: ${role} -> ${permission}`);
}

assert.ok(/agency_id=v_agency/g.test(s),'tenant key must be derived into agency-scoped SQL');
assert.ok(s.includes("where id=p_document_id and agency_id=v_agency"),'candidate document lookup must bind tenant before authorization');
assert.ok(s.includes("private.xzrecruiter_candidate_object_access"),'object-level candidate authorization missing');
assert.ok(s.includes("private.xzrecruiter_job_object_access"),'object-level requirement authorization missing');

assert.ok(!/\bdrop\s+table\b|\btruncate\b|alter\s+table\s+[^;]+\s+drop\s+column/i.test(s),'Step-7 migration contains unsafe destructive DDL');

console.log('STEP7_DB_SECURITY_PASS session=true rls=true direct_grants_denied=true rbac=true object_auth=true classification=true audit=true migration_safe=true');
