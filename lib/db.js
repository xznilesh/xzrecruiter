// XZRecruiter uses narrowly scoped SECURITY DEFINER RPCs over Supabase's Data API.
// This keeps database passwords and service-role keys out of Vercel entirely.
export { rpc } from '@/lib/supabase-api';
