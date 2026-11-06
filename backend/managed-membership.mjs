import { MembershipError, findSubscriptionForEmail, verifyPaidSubscription } from './paypal-membership.mjs';

const unavailable = () => new MembershipError('membership_unavailable', 503, 'Account services are temporarily unavailable. Please try again later.');
const loginRequired = () => new MembershipError('member_login_required', 401, 'Sign in to your A to Z Wise AI account.');
export function isPublicSupabaseKey(value) {
  if (typeof value !== 'string') return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  // Legacy public keys carry the anon role. This is a configuration guard,
  // never a substitute for verifying a customer's token with Supabase.
  try {
    const parts = value.split('.');
    return parts.length === 3 && JSON.parse(atob(parts[1].replaceAll('-', '+').replaceAll('_', '/'))).role === 'anon';
  } catch { return false; }
}
export function managedReady(env) {
  return env.MEMBER_LOGIN_METHOD === 'supabase' && env.MANAGED_ACCOUNTS_ENABLED === 'true' &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.SUPABASE_URL || '') &&
    Boolean(isPublicSupabaseKey(env.SUPABASE_PUBLIC_KEY) && env.SUPABASE_SERVICE_ROLE_KEY && env.PAYPAL_CLIENT_ID &&
      env.PAYPAL_CLIENT_SECRET && env.PAYPAL_PLAN_ID && ['live', 'sandbox'].includes(env.PAYPAL_ENVIRONMENT));
}
async function jsonFetch(url, options, fetchImpl, service) {
  try { return await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) }); }
  catch { throw new MembershipError(service + "_connection", 503, "Could not connect to the account service. Please try again."); }
}
export async function managedUser(request, env, fetchImpl = fetch) {
  if (!managedReady(env)) throw unavailable();
  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) || authorization.length > 8192) throw loginRequired();
  const response = await jsonFetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLIC_KEY, Authorization: authorization }
  }, fetchImpl, 'identity');
  if ([401,403].includes(response.status)) throw loginRequired();
  if (!response.ok) throw new MembershipError("identity_lookup_" + response.status, 503, "Your account could not be verified. Please try again.");
  const user = await response.json();
  // Never trust user_metadata, decoded-but-unverified JWTs, or client email.
  if (!/^[a-f0-9-]{36}$/i.test(user.id || '') || !user.email_confirmed_at ||
      typeof user.email !== 'string' || user.is_anonymous) throw loginRequired();
  return user;
}
async function database(path, env, options = {}, fetchImpl = fetch) {
  const response = await jsonFetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  }, fetchImpl, 'membership');
  if (response.status === 409) throw new MembershipError('subscription_already_linked', 409, 'This subscription is already linked to an account. Sign in to that account; do not pay again.');
  if (!response.ok) throw new MembershipError("membership_lookup_" + response.status, 503, "Your membership could not be loaded. Please try again.");
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
async function linked(user, env, fetchImpl) {
  const rows = await database(`member_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=subscription_id,payer_id`, env, {}, fetchImpl);
  return rows[0] || null;
}
export async function authorizeManagedMember(request, env, fetchImpl = fetch) {
  const user = await managedUser(request, env, fetchImpl);
  const record = await linked(user, env, fetchImpl);
  if (!record) throw new MembershipError('membership_required', 403, 'Link your paid subscription on the account page. You do not need to pay again.');
  return verifyPaidSubscription({ subscriptionId: record.subscription_id, payerId: record.payer_id }, env, { fetchImpl });
}
export async function handleManagedRoute(request, env, fetchImpl = fetch) {
  const path = new URL(request.url).pathname;
  if (path === '/api/member/config') {
    return { ready: managedReady(env), method: 'supabase',
      ...(managedReady(env) ? { url: env.SUPABASE_URL, publicKey: env.SUPABASE_PUBLIC_KEY } : {}) };
  }
  const user = await managedUser(request, env, fetchImpl);
  if (path === '/api/member/account') {
    const record = await linked(user, env, fetchImpl);
    if (!record) return { email: user.email, linked: false, active: false };
    try {
      await verifyPaidSubscription({ subscriptionId: record.subscription_id, payerId: record.payer_id }, env, { fetchImpl });
      return { email: user.email, linked: true, active: true };
    } catch (error) {
      if (error.code !== 'membership_required') throw error;
      return { email: user.email, linked: true, active: false };
    }
  }
  if (path === '/api/member/link') {
    const origin = request.headers.get('Origin');
    if (!origin || !(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(origin)) throw new MembershipError('origin_denied',403,'Use the account page to link your subscription.');
    const permitted = await database('rpc/allow_member_link', env, { method:'POST', body:JSON.stringify({account_id:user.id}) }, fetchImpl);
    if (permitted !== true) throw new MembershipError('too_many_requests',429,'Too many linking attempts. Please try again in an hour.');
    const text = await request.text();
    if (text.length > 1024) throw new MembershipError('invalid_subscription',400,'Enter your PayPal subscription ID.');
    let body; try { body = JSON.parse(text); } catch { throw new MembershipError('invalid_subscription',400,'Enter your PayPal subscription ID.'); }
    const membership = await findSubscriptionForEmail({ subscriptionId: body?.subscriptionId, email: user.email }, env, { fetchImpl });
    // Unique constraints protect both sides; no client can overwrite ownership.
    const existing = await linked(user, env, fetchImpl);
    if (existing?.subscription_id === membership.subscriptionId) return { linked: true, active: true };
    if (existing) throw new MembershipError('subscription_already_linked',409,'Your account already has a linked subscription. Contact support before changing it.');
    await database('member_subscriptions', env, { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: user.id, subscription_id: membership.subscriptionId, payer_id: membership.payerId }) }, fetchImpl);
    return { linked: true, active: true };
  }
  throw new MembershipError('not_found',404,'Endpoint not found.');
}
