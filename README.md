# XZRecruiter

Production XZRecruiter hiring-intelligence and recruiter operating workspace.

## Runtime architecture
- Next.js 16.3.3 on Vercel
- Supabase PostgreSQL
- Browser-facing tables remain protected by RLS
- App access uses narrowly scoped `SECURITY DEFINER` RPCs and per-user opaque HTTP-only sessions
- Only a Supabase publishable key is used by the web runtime; no database password or service-role key is required on Vercel

## Product surface
- Premium public landing page
- Agency signup/login
- Secure 30-day sessions with bcrypt password hashing inside PostgreSQL
- Today’s hiring radar and explainable Hiring Heat
- Company/job metrics and recruitment pipeline overview
- Production readiness endpoint at `/api/health/ready`
