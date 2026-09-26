# Step 9 — Production QA + Pilot Validation + Launch Readiness

This is the final locked roadmap step. There is no Step 10.

## Release policy

Production launch is blocked unless Unit, Integration, E2E, Security, AI Regression/Evaluation, Load/Performance, live database security/integrity, production readiness health, browser E2E, backup/restore evidence, and pilot evidence all pass.

A successful build, homepage response, TypeScript check, or isolated E2E test is not release evidence.

## Initial issue register — 2026-09-26

| ID | Severity | Finding | Evidence | State |
|---|---|---|---|---|
| S9-P0-001 | P0 | Locked-roadmap Git history was split: canonical Steps 1–7 and Step 8 were on divergent branches. | Step 9 audit compared branch ancestry and trees. | FIXED by the Step-9 reconciliation merge tree. |
| S9-P0-002 | P0 | Production readiness endpoint returns HTTP 503 because the database is unreachable. | `https://xzrecruiter.vercel.app/api/health/ready` returned `database=unreachable` on 2026-09-26. | OPEN. |
| S9-P0-003 | P0 | The connected Supabase account does not expose the repo-configured XZ Recruiter project `fpfwvvjxodcchgyguvpv`; live RLS, storage, migration, cross-tenant and restore tests cannot be truthfully executed against it. | Connector project inventory does not include the configured project. | OPEN / external access blocker. |
| S9-P0-004 | P0 | Supabase migration filenames contain duplicate version prefixes (including multiple `20260903_*`, `20260925_*`, and `20260927_*`). | Repository migration audit. | OPEN. Do not rename blindly until remote migration history is verified. |
| S9-P1-001 | P1 | Current production deployment predates the locked Step-5–8 release candidate and therefore cannot represent the current product. | Vercel deployment inventory vs Git commit dates. | OPEN until release gates pass; do not promote early. |
| S9-P1-002 | P1 | Live provider AI evaluation cannot be certified without a server-side provider credential in the release environment. | Step-9 release gate. | OPEN unless configured. |
| S9-P1-003 | P1 | Browser E2E, backup/restore drill and staffing-team pilot need externally verifiable evidence. | Step-9 release gate evidence variables. | OPEN until executed. |

## Repository QA implemented

Step 9 reuses the permanent Step-1 through Step-8 suites and adds a cross-step orchestration layer. CI executes:
- unit
- integration
- deterministic golden-path E2E and AM return/correction loop
- security and privilege regression
- AI fixture regression
- load/performance suites with measured existing outputs
- responsive/accessibility source baseline
- dependency audit
- production build

The cross-step E2E contract covers:
JD → Hiring Brief → AM approval → assignment → sourcing → resume → duplicate gate → candidate intelligence → human screening → qualified → Submission Pack → AM return/correction → AM approval → client submission → interview → offer → joining → manager metrics.

Failure-path contract coverage includes invalid JD, AI parse failure, missing requirement data, malformed/parser-failed resume, duplicate candidate, candidate not interested, no response, incomplete screening, failed hard requirement, incomplete submission, withdrawal, client rejection, cancelled interview, declined offer, joining failure, job failure, AI-provider failure and network retry.

## Security release checks

Existing Step-7/Step-8 suites remain mandatory. Step 9 additionally refuses release until the verified live database passes:
- tenant tables have RLS
- direct anon/authenticated table grants are absent
- health RPC exists
- migration history matches source
- core application/submission orphan checks are zero
- duplicate live submissions are zero
- impossible client-submission states are zero

Cross-tenant, RBAC, IDOR, signed/private storage, rate limiting, service-role isolation, idempotency, optimistic locks and concurrent automation controls are covered by the inherited Step-7/Step-8 suites. Live abuse validation remains blocked until the correct Supabase project is accessible.

## Migration gate

Do not alter existing migration timestamps solely to make CI green. First connect the actual XZ Recruiter Supabase project and compare `supabase_migrations.schema_migrations` with repository history. Then resolve timestamp collisions on a safe branch/clone, run a clean reset, verify ordering/RLS/functions/indexes, and reconcile remote history using the provider-supported migration repair process if required. Production migration changes must not be improvised.

## Backup and restore

Release requires a safe non-production restore drill and an evidence reference in `XZRECRUITER_BACKUP_RESTORE_EVIDENCE`. Record:
- provider backup mechanism and frequency
- PITR availability
- restore target
- measured restore outcome
- RPO/RTO assumptions

No restore success is claimed until the drill actually runs.

## Staging → production promotion

Code freeze candidate → source CI → migration validation → staging deploy → production-like smoke/golden E2E → browser/responsive/accessibility pass → security/live DB pass → AI live evaluation → backup/restore evidence → pilot evidence → release approval → production promotion → production smoke.

The release gate is intentionally fail-closed.

## Rollback

Application: retain the last known-good Vercel production deployment and use provider rollback/promotion.

Database: prefer additive migrations. Recovery of an incompatible migration must use a verified backup/PITR or a tested forward-fix; do not perform emergency destructive surgery.

AI: keep qualification and AM approval human-controlled; provider failure must degrade to a safe retry/manual path and never auto-qualify or auto-submit.

Automation: privileged scheduled/event workers must be pausable by disabling their schedule/secret or tenant automation control without modifying business data.

## Launch-day smoke

The deterministic release sequence is:
1. readiness endpoint
2. login and organization membership
3. approved requirement create/open
4. recruiter assignment/workspace
5. candidate + document access
6. candidate intelligence
7. screening/qualification
8. Submission Pack → AM → client submission
9. manager dashboard and notification health
10. audit event and metrics consistency

Authenticated production smoke is not marked complete until executed with dedicated pilot accounts and seeded non-production/approved production-safe fixtures.

## Current verdict

**BLOCKED — NOT PRODUCTION READY.**

This is the correct Step-9 result while any P0/P1 mandatory release blocker remains open. The project must not be promoted merely because source CI is green.
