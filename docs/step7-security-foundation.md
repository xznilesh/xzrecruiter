# XZ Recruiter — Step 7 Security & Data Foundation

## Scope

This document covers locked roadmap **Step 7 only**. It hardens the Step-1 through Step-6 product without adding Step-8 automation or manager-control features.

The canonical tenant key in the current schema is `agency_id`. It represents the organization/workspace boundary.

## Threat model

Assume:

- browser requests and IDs are attacker-controlled;
- UI visibility is not authorization;
- multiple organizations share the same database/application infrastructure;
- custom session tokens can be replayed until revoked/expired;
- `SECURITY DEFINER` RPCs bypass table RLS and therefore require explicit session, tenant, role and object checks;
- uploaded files, JD text, resumes, notes and portal payloads are hostile input;
- privileged service-role credentials bypass RLS;
- signed URLs may leak and remain usable until expiry;
- duplicate/retried requests and concurrent actors are normal;
- AI/provider failures and retries are normal.

## Threat surface map

### Browser / HTTP API

The repository currently exposes server routes under:

- ATS actions, documents, attachments and resumes;
- authentication and password/email verification;
- configuration, onboarding and workspace settings;
- CRM and imports;
- public job application;
- candidate portal;
- client feedback portal;
- vendor portal;
- submission pack / AM quality-gate actions;
- readiness/health.

Mutation routes must enforce request integrity, declared-body bounds where a body is parsed, and durable rate limits for public/auth/cost-heavy surfaces.

### Database / RPC boundary

Normal application RPCs use a Supabase publishable key plus an opaque XZ Recruiter session token. Therefore public `SECURITY DEFINER` functions are part of the authorization boundary.

Controls:

1. session context derives `agency_id`, `user_id`, and membership role server-side;
2. disabled users, inactive memberships, revoked sessions and expired sessions are rejected;
3. direct table Data API access is deny-by-default;
4. tenant tables with `agency_id` have RLS enabled with deny policies for `anon`/`authenticated`;
5. direct table grants are revoked;
6. default future table/function grants are revoked;
7. views are forced to `security_invoker=true`;
8. privileged object access performs tenant + role + relationship checks.

### Membership / authentication

- role/active membership changes revoke active workspace sessions;
- disabling a user revokes active sessions;
- invitation records cannot encode OWNER;
- invitation business roles are constrained to canonical roles;
- login returns opaque random session tokens, stored only as hashes;
- auth/public abuse endpoints use durable DB-backed rate limits.

### Candidate / requirement object authorization

Recruiter candidate access requires:

- same tenant;
- candidate not archived;
- candidate ownership **or** an application connected to the recruiter's ACTIVE assignment;
- the underlying requirement remains OPEN, recruiter-ready and has an approved Hiring Brief.

Manager/AM/compliance access remains permission-based and tenant-scoped.

### Documents / storage

- private server-side Storage API only;
- service-role credential exists only in server modules;
- filenames and object paths are normalized/validated;
- MIME + extension + file magic/content checks;
- upload size limits;
- overwrite disabled;
- signed URLs are issued only after DB authorization;
- signed URL TTL is clamped to <= 60 seconds;
- no public Storage URL helper is used.

**Provider limitation:** Supabase signed URLs remain valid until their expiry. Removing a user's role cannot revoke an already-issued URL instantly. The 60-second TTL limits this exposure.

A distinct sensitive-bucket environment variable exists as a foundation. Current production bucket provisioning and migration of any future non-resume identity/work-authorization documents must be verified before such documents are enabled.

### AI boundary

AI/provider calls must remain server-side. Source JD/resume/profile/note content is untrusted data and must never be treated as instructions. Tenant-authorized retrieval happens before any AI input is constructed.

Step 4 uses tenant-scoped matching; the current implementation does not claim global semantic/vector ranking. If pgvector/semantic matching is enabled later, the candidate set must be restricted by tenant/authorization **before** ranking.

### Submissions / commercial data

Step-6 submission actions retain:

- idempotency keys;
- version snapshots;
- optimistic version/lock checks;
- advisory locks on critical mutations;
- AM-only review and client-submit authorization;
- client-facing commercial sanitization;
- duplicate client-submission guards.

Step 7 adds centralized commercial view/edit permission gating and security events for denied reads/writes.

### Audit / security events

Operational activity and security-significant events are separate.

Security events cover authorization denial, sensitive document access, role/membership changes, bulk export, AM/client submission actions and commercial access.

Ordinary Data API roles cannot UPDATE/DELETE audit/security event tables.

## Data classification

- `PUBLIC_LOW`: intended public/low-risk material.
- `INTERNAL`: internal operational metadata.
- `CONFIDENTIAL`: client rates, submissions, commercial decisions, internal business information.
- `HIGHLY_SENSITIVE`: candidate PII, private documents, work-authorization information, screening answers/facts and comparable candidate-sensitive data.

Classification is enforced by CHECK constraints on Step-1 through Step-6 sensitive entities added by Step 7.

## Export safety

Bulk candidate export is denied by default for recruiters/recruitment managers unless organization governance explicitly allows it. Candidate export is tenant/object scoped, rate limited and security logged.

CSV output must neutralize spreadsheet formula prefixes (`=`, `+`, `-`, `@`, tab/CR variants).

## Data retention foundation

`organization_data_governance` stores candidate/security-event retention policy and export permissions. This is a foundation, not a full legal/compliance deletion workflow.

Historical submission/audit/compliance records should be archived/retained rather than destructively deleted when history is required.

## Backups / PITR / restore

The connected Supabase account available during Step 7 exposes only an **INACTIVE project named "Xzbyteone project"** and does not identify the production XZ Recruiter database.

Therefore the following are **production requirements / external blockers** until the correct project is connected:

1. verify scheduled backups;
2. verify PITR entitlement/configuration;
3. record retention window;
4. perform a non-production restore rehearsal;
5. verify Storage backup/recovery expectations separately from Postgres;
6. run Supabase security/performance advisors against the actual XZ Recruiter project.

Do not claim backup/PITR/restore validation until those checks are performed on the correct project.

## Migration safety

Step-7 migration is additive/hardening oriented:

- no `DROP TABLE`;
- no `TRUNCATE`;
- no destructive column removal;
- default privileges are tightened;
- legacy callable functions are renamed/revoked only where a guarded wrapper replaces them.

Production procedure:

1. snapshot/backup before migration;
2. apply to staging/copy first;
3. run live Step-7 DB security checks;
4. run app CI/E2E;
5. deploy application;
6. verify auth, document access, recruiter/AM flows;
7. retain rollback SQL/application release;
8. only then promote production.

## Live security verification

Repository CI proves static contracts and application behavior. The separate live DB gate must verify on the actual project:

- every tenant table RLS state;
- direct grants to `anon`/`authenticated`;
- view `security_invoker`;
- SECURITY DEFINER exposure;
- cross-tenant negative reads/mutations;
- signed document authorization;
- role-change/session revocation;
- security advisors;
- index/advisor findings.

## Rate limiting

Rate limiting is durable and DB-backed via a service-role-only RPC plus a server-side peppered identity hash. If `SUPABASE_SERVICE_ROLE_KEY` or `XZRECRUITER_RATE_LIMIT_PEPPER` is missing, protected routes fail closed.

## Malware scanning

The current file pipeline validates size, MIME, extension and file signatures. No verified malware-scanning provider is connected.

Before enabling uploads of higher-risk identity/work-authorization documents, connect an approved scanner/quarantine workflow. This is an external production hardening item; Step 7 does not fabricate a scanner result.

## Step-8 exclusion

No autonomous monitoring, scheduled manager-control, document-expiry automation, or next-best-action automation belongs to this security foundation.
