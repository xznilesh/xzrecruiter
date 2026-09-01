# ReqRadar — Global SaaS Build — Cumulative MVP through Step 20

ReqRadar is a hiring-intent client radar for specialist recruitment agencies. This repository contains the cumulative implementation through **Step 20: Paid Pilot + Outcome Learning + Production Launch**.

## Product flow now implemented

1. Agency onboarding and market profile
2. Target-company monitoring universe
3. Public ATS connectors
4. Career-page fallback monitoring
5. Canonical job normalization and dedupe
6. Company Memory / lifecycle graph
7. Freshness detection
8. Stale/repost detection
9. Cybersecurity role taxonomy
10. Agency-fit scoring
11. Hiring velocity + urgency
12. Explainable Hiring Heat
13. Today’s Radar
14. Evidence-first company Trust Screen
15. Daily digest + instant alerts
16. Recruiter actions and outcomes
17. Owner weekly BD impact + modeled economics
18. CSV exports
19. Production reliability, worker heartbeats and readiness checks
20. **INR pricing, paid-pilot controls, legal acceptance, outcome-learning safeguards and launch governance**

## Step 20 commercial catalog

| Plan | INR price | Tracked companies | Niche limit | Key entitlements |
|---|---:|---:|---:|---|
| 14-Day Pilot | ₹0 | 100 | 1 | Daily Radar, daily email, outcome reporting |
| Solo | ₹4,000/month | 250 | 1 | Daily Radar + daily email |
| Pro | ₹8,000/month | 1,000 | Multiple | Instant alerts, CSV export, outcome reporting |
| Agency | ₹16,000/month | 5,000 | Multiple | Team workspace, shared intelligence, alerts, exports, outcome reporting |

The paid-plan activation endpoint in this build records **product entitlement only**. It does not collect a card/bank payment and must not be treated as proof of payment. A real billing provider adapter/webhook remains a release integration.

## Legal package

Step 20 contains versioned Terms and Conditions, Privacy Notice, acceptance logging, and launch gates for operator legal identity.

## Outcome-learning safety

Outcome learning is evaluation-first, not autonomous model mutation. Proposals require manual owner/admin review and do not automatically change production scoring weights.

## Step 20.1 — Global Localization + Multi-Currency

Added fixed India/US/UK price books, owner-confirmed billing country, locale/timezone preferences, tax-ready billing fields, regional legal document versioning, localized launch pricing and the professional ReqRadar wordmark. See `docs/STEP20_1_GLOBAL_LOCALIZATION.md`.
