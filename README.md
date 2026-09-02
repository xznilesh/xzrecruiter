# XZRecruiter

Production rebuild of XZRecruiter: hiring-intelligence radar + recruiter operating workspace.

## Product surface
- Premium public landing page
- Secure agency signup/login with server-side sessions
- Today’s hiring radar and explainable Hiring Heat
- Company/job monitoring metrics
- Recruitment client + candidate pipeline overview
- Production readiness endpoint at `/api/health/ready`
- PostgreSQL/Supabase server-only runtime access

## Runtime
Set `DATABASE_URL` to the restricted XZRecruiter database role. No database secret is exposed to the browser.

## Health
`GET /api/health/ready` returns HTTP 200 only when the app can reach PostgreSQL.
