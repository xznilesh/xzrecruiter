const SUPABASE_URL = 'https://fpfwvvjxodcchgyguvpv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_PIRf6sLlw2gitcSH4MHlgg_cEeUMKIY';

export async function rpc(name, args = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(args),
    cache: 'no-store'
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = text; }
  }

  if (!response.ok) {
    const error = new Error(`Supabase RPC ${name} failed with HTTP ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}
