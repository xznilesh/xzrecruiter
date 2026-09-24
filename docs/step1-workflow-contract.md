# XZ Recruiter — Step 1 Workflow & Product Contract Lock

Status: repository contract for Step 1 only  
Contract version: `xzrecruiter-step1-v1`  
Locked roadmap scope: **Step 1 only**. This document does not implement AI JD Brain, AI candidate analysis, submission-pack generation, automation, or launch QA.

## 1. Canonical operating model

There is one product workflow:

**Client JD → AM receives requirement → AI Hiring Brief → AM confirms client intent → Recruiter sourcing → Candidate enters XZ Recruiter → AI candidate analysis → Human recruiter screening → Recruiter internal submission → AI Submission Pack → AM Quality Gate → Client submission → Interview → Offer → Joining → analytics/learning loop.**

The ATS is infrastructure underneath this workflow. Candidate identity, application history, source provenance, duplicate evidence, stage history, activities, documents, interview history, offers and audit records may continue to use existing ATS tables, but they are not a second product workflow and must not create extra recruiter data-entry gates.

## 2. Repository audit and legacy mapping

Audited areas:
- `app/api/ats/**`, `app/api/crm/**`, public portal APIs and auth/config routes.
- Recruiter-facing workspaces: pipeline, candidate, job, screening, interview, offer, placement and CRM surfaces.
- `lib/ats.js`, `lib/crm.js`, auth/session, DB/storage wrappers.
- Step 1–5 migrations, especially tenant/session binding, pipeline configuration, ATS core/RPCs, stage guards, candidate submission, private documents and CRM tenant hardening.
- Existing verification scripts and GitHub Actions workflow.

Valid background infrastructure retained:
- tenant-scoped candidates/jobs/applications
- candidate documents and parse runs
- duplicate/merge records
- application stage history
- recruitment activity events
- screening answers
- candidate submission records
- interview/scorecard records
- offers/offer approvals
- placement records
- private attachments and portal records
- saved views/search and tenant-scoped CRM data

Contradictions identified:
1. Recruiter screening UI exposed a direct **Submit to client** action.
2. `xzrecruiter_save_candidate_submission(..., p_submit=true)` immediately set legacy status `SUBMITTED` and logged “Candidate submitted to client”, bypassing AM Quality Gate.
3. The existing board permitted free movement among configured stages; evidence requirements existed but canonical transition adjacency was not enforced.
4. Core ATS write authorization relied mainly on coarse legacy membership roles, while business roles already existed separately.
5. Existing legacy pipeline names (`NEW/APPLIED/SHORTLISTED/PLACED`) can be useful as storage/history labels but cannot define a competing product workflow.
6. `COMPLIANCE_REVIEWER` was missing from the business-role vocabulary.

Step-1 resolution:
- recruiter submission is now an **internal AM handoff**;
- AM review and actual client release are distinct guarded transitions;
- application stage movement routes through a canonical transition guard;
- the old unguarded public stage-move function is removed from the browser/API contract;
- legacy ATS state remains available as background/history and is mapped to canonical business states.

## 3. Role contract

### Owner / Admin
May administer the organization and, operationally, perform authorized human transitions as an override/supervisory role. Overrides must remain auditable.

### Account Manager
Owns:
- client relationship;
- requirement interpretation;
- approval/return of the Hiring Brief;
- client-specific context;
- AM Quality Gate;
- client submission/release;
- client feedback and requirement changes;
- downstream client-facing interview/offer/joining coordination.

Does **not** own recruiter human screening.

### Recruitment Manager
Owns:
- recruiter assignment/oversight;
- recruiter execution support;
- sourcing/screening/qualification where operationally required;
- internal submission;
- interview operational support;
- joining operational support.

Does not own AM Quality Gate or client submission.

### Recruiter
Owns:
- external sourcing;
- candidate communication;
- real interest validation;
- human screening;
- practical candidate data confirmation;
- qualify/not-qualify human decision with AI assistance;
- internal submission to Account Manager.

Cannot perform AM Quality Gate or release a candidate to the client.

### Compliance Reviewer
Read/review role for compliance and audit context. No recruiter, AM, offer or joining decision authority is implied.

### Future Client user
May supply client feedback or explicitly client-owned responses when a portal is introduced/retained. A client user does not inherit internal recruiter/AM permissions.

### AI
AI is an advisory/intelligence actor, not an autonomous hiring authority.

AI may:
- analyze JD;
- extract structured requirements;
- draft Hiring Brief/ideal profile;
- flag hard requirements/red flags;
- analyze candidates;
- explain fit/gaps;
- detect duplicates/inconsistencies;
- generate screening guidance;
- draft submission summary;
- recommend next actions.

AI must never:
- approve the Hiring Brief;
- make final human screening decisions;
- submit to a client without AM control;
- make irreversible hiring decisions;
- accept an offer for a candidate;
- confirm joining;
- bypass tenant or role boundaries.

## 4. Canonical state machines

The executable definitions live in `lib/workflow-contract.mjs`. Summary:

### Requirement
`JD_RECEIVED → AI_BRIEF_PENDING → AM_REVIEW → APPROVED → OPEN`

Controlled alternatives:
- AM review may return to `AI_BRIEF_PENDING`;
- `OPEN ↔ CHANGE_PENDING_AM_CONFIRMATION`;
- `OPEN ↔ ON_HOLD`;
- `OPEN → CLOSED | CANCELLED`.

### Candidate / Candidacy
`SOURCED → AI_ANALYSIS_PENDING → READY_FOR_HUMAN_SCREEN → SCREENING → QUALIFIED → INTERNAL_SUBMISSION → AM_REVIEW → CLIENT_SUBMITTED → INTERVIEW → OFFER → JOINING → JOINED`

Controlled terminal/exception states:
- screening may reject/withdraw;
- AM review may return the candidacy to qualified recruiter ownership, reject, or client-submit;
- post-client stages may reject/withdraw where relevant.

### Screening
`NOT_STARTED → IN_PROGRESS → QUALIFIED | NOT_QUALIFIED | CANDIDATE_WITHDREW`  
`IN_PROGRESS ↔ NEEDS_CLARIFICATION`

Only authorized humans finalize screening.

### Internal Submission
`DRAFT → INTERNAL_SUBMITTED → AM_APPROVED → CLIENT_SUBMITTED`

AM may instead:
- `INTERNAL_SUBMITTED → RETURNED_TO_RECRUITER → INTERNAL_SUBMITTED`;
- `INTERNAL_SUBMITTED → AM_REJECTED`.

### AM Review
`NOT_REQUESTED → PENDING → APPROVED | REJECTED`  
or `PENDING → RETURNED_TO_RECRUITER → PENDING`.

### Client Submission
`NOT_SUBMITTED → SUBMITTED → VIEWED/FEEDBACK_PENDING/INTERVIEW_REQUESTED/REJECTED/WITHDRAWN`.

Only AM/authorized supervisory roles can perform the internal release; client portal actors may later record client-owned feedback transitions only.

### Interview
`NOT_SCHEDULED → SCHEDULED → COMPLETED`  
with `RESCHEDULED`, `CANCELLED`, and `NO_SHOW` controlled alternatives.

### Offer
`NOT_CREATED → DRAFT → INTERNAL_APPROVAL_PENDING → APPROVED → SENT → VIEWED → ACCEPTED`  
with controlled `DECLINED/WITHDRAWN/EXPIRED` outcomes.

### Joining
`NOT_STARTED → PRE_JOINING → CONFIRMED → JOINED`  
with `DID_NOT_JOIN/CANCELLED` outcomes.

## 5. Forbidden transition examples

The contract rejects, among others:
- recruiter: `SOURCED → CLIENT_SUBMITTED`;
- recruiter: AM approval or client submission;
- AM: final human recruiter screening;
- AI: human-screening qualification;
- any actor: `DRAFT submission → CLIENT_SUBMITTED` without internal submission + AM approval;
- application board: arbitrary stage jumps such as `SOURCED → OFFER`;
- offer: `DRAFT → SENT` without required internal approval;
- joining: `NOT_STARTED → JOINED` without pre-joining/confirmation.

## 6. Legacy stage mapping

The legacy recruitment board is retained as infrastructure and mapped as follows:

| Legacy stage | Canonical candidacy state |
|---|---|
| NEW / APPLIED | SOURCED |
| SCREENING | SCREENING |
| QUALIFIED / SHORTLISTED | QUALIFIED |
| SUBMITTED | CLIENT_SUBMITTED |
| INTERVIEW | INTERVIEW |
| OFFER | OFFER |
| PLACED / HIRED | JOINED |
| REJECTED | REJECTED |
| WITHDRAWN | WITHDRAWN |

A legacy stage not mapped above is non-canonical for Step 1 and is rejected by the guarded movement API rather than silently becoming a new product state.

## 7. Audit vocabulary

Canonical critical events:
- `requirement.jd_received`
- `requirement.ai_brief_requested`
- `requirement.ai_brief_ready`
- `requirement.am_approved`
- `requirement.am_returned`
- `requirement.changed`
- `candidate.sourced`
- `candidate.entered_system`
- `candidate.ai_analysis_requested`
- `candidate.ai_analysis_ready`
- `screening.started`
- `screening.updated`
- `screening.qualified`
- `screening.not_qualified`
- `submission.draft_saved`
- `submission.internal_submitted`
- `submission.am_returned`
- `submission.am_approved`
- `submission.am_rejected`
- `submission.client_submitted`
- `client.feedback_received`
- `interview.scheduled`
- `interview.rescheduled`
- `interview.completed`
- `offer.created`
- `offer.approved`
- `offer.sent`
- `offer.accepted`
- `offer.declined`
- `joining.started`
- `joining.confirmed`
- `joining.joined`
- `joining.did_not_join`
- `workflow.override`

Every critical transition contract requires:
- actor ID;
- actor type;
- organization/tenant ID;
- entity type;
- entity ID;
- timestamp;
- action;
- optional metadata/reason.

Existing `recruitment_activity_events` and stage-history records remain the persistence infrastructure. Step 1 does not build a second audit store.

## 8. Minimum later-step data contract

Step 1 defines, but does not prematurely populate later AI fields:

- Requirement: ID, organization, client, AM, state, raw JD reference, version, timestamps.
- Candidate: ID, organization, source/provenance, primary resume version, timestamps.
- Candidacy: organization + requirement + candidate + recruiter + state.
- Screening: candidacy, recruiter, state, interest, communication, availability, expectations, completion time.
- Internal Submission: candidacy, exact resume version, state, submitting recruiter, submission time.
- AM Review: internal submission, AM, decision state, reason, review time.
- Client Submission: internal submission, client, submitting AM, state, submission time.
- Interview: candidacy, state, schedule, timezone.
- Offer: candidacy, state, version, creation time.
- Joining: candidacy, offer, state, planned start/joined time.
- Audit Event: organization, actor, actor type, entity, action, timestamp, metadata.

## 9. API/service boundaries

- **Requirements** owns requirement lifecycle and AM-confirmed client intent. Step 2 AI plugs into this boundary later.
- **Candidates** owns candidate identity/profile and source provenance, not job-specific decisions.
- **Candidacies** owns candidate × requirement lifecycle and recruiter ownership.
- **Screening** owns human screening facts and decision; AI guidance is advisory input.
- **Submissions** owns recruiter internal handoff → AM review → client release on the same record chain.
- **Interviews** owns interview status on that candidacy.
- **Offers** owns offer versions/status on that candidacy.
- **Joining** owns pre-joining and joined outcome.
- **Audit** records critical actions and context but does not own workflow decisions.

No Step-2 AI parser, Step-3 workspace redesign, Step-4 intelligence engine, Step-8 automation, or Step-9 production QA system is introduced by this contract.

## 10. Security/tenant invariants retained

- callers never supply an organization ID for ATS mutations; organization remains derived from the verified session;
- every new submission/review/client-release query filters by `agency_id=v_agency`;
- existing RLS/direct-browser deny remains enabled;
- the new workflow stage API wraps the mature evidence/history function rather than bypassing it;
- the legacy unguarded browser-callable stage move is revoked;
- helper functions in `private` have execution revoked from browser roles.

The repository migration is intentionally additive. It does not drop tables, truncate data, or drop existing data columns.

## 11. Explicit Step-1 non-goals

Not built here:
- JD parsing/model prompts;
- candidate scoring or matching;
- generated screening questions;
- generated Submission Packs;
- real-time manager control/background jobs;
- new client portal features;
- load testing/pilot launch automation.

Those remain later locked roadmap steps.
