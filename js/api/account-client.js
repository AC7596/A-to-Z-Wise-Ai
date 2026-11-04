export const accountBackend = 'https://a-to-z-wise-ai-backend.ad9259465.workers.dev';
let pending;
export function getAccountClient() {
  if (!pending) pending = (async () => {
    const response = await fetch(`${accountBackend}/api/member/config`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const config = await response.json();
    if (!config.ready || config.method !== 'supabase') return null;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url || '')) throw new Error('Account configuration is unavailable.');
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm');
    return createClient(config.url, config.publicKey, { auth: {
      storageKey: 'atoz-managed-account', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false
    } });
  })().catch(error => { pending = null; throw error; });
  return pending;
}
export async function getAccountToken() {
  const client = await getAccountClient();
  if (!client) return '';
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.access_token || '';
}
export async function accountRequest(path, body) {
  const token = await getAccountToken();
  if (!token) throw new Error('Sign in to your account first.');
  const response = await fetch(`${accountBackend}/api/member/${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Account service is temporarily unavailable.');
  return result;
}
