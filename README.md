# XZ Recruiter

XZRecruiter is a global recruitment intelligence and agency operating system.

## Current engineering state

- Step 1: security/authentication/branding foundation
- Step 2: global localization, IANA timezone and product shell foundation
- Step 3: agency onboarding and recruitment configuration
- Step 4: global enterprise ATS source closeout on `step4-global-enterprise-ats`

Step 4 includes Candidate 360, private PDF/DOCX/TXT resume ingestion with confidence review, duplicate merge, talent pools, advanced server-side search/saved views, candidate and job bulk operations, configurable pipeline board/table flows, screening, client submissions, global interviews and scorecards, offer approvals/version history, placements, public apply, and an editable candidate portal with private resume refresh.

Production activation is intentionally separate: Step-4 SQL migrations, private storage secrets/bucket, Vercel deployment, live tenant-isolation checks, real-dataset p95 measurements and end-to-end production certification must be completed before calling the live environment Step-4 certified.

## Verification

```bash
npm install
npm run lint
npm run test:step2
npm run test:step3
npm run test:step4
npm run test:step4:closeout
npm run build
```

The closeout suite is source/architecture verification; it does not claim production latency or competitor benchmark results.
