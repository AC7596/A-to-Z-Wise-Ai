import { MembershipError, verifyPaidSubscription } from './paypal-membership.mjs';
import { managedReady, authorizeManagedMember, handleManagedRoute } from './managed-membership.mjs';

const encoder = new TextEncoder();
const cookieName = '__Host-atoz_member_state';
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const decode = text => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
const unauthorized = () => new MembershipError('member_login_required', 401, 'Sign in on the Member access page to use real AI diagnosis.');
const unavailable = () => new MembershipError('membership_unavailable', 503, 'Member sign-in is being set up. Please keep your PayPal receipt; you do not need to subscribe again.');
export function memberReady(env) {
  if (env.MEMBER_LOGIN_METHOD === 'supabase') return managedReady(env);
  return env.PAYPAL_LOGIN_APPROVED === 'true' && Boolean(env.PAYPAL_CLIENT_ID &&
    env.PAYPAL_CLIENT_SECRET && env.PAYPAL_PLAN_ID && env.MEMBER_CALLBACK_URL &&
    env.MEMBER_SITE_URL && env.MEMBER_SESSION_SECRET?.length >= 32 &&
    ['live', 'sandbox'].includes(env.PAYPAL_ENVIRONMENT));
}
async function key(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw unavailable();
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signMemberToken(payload, secret) {
  const body = encode(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(body));
  return `${body}.${encode(new Uint8Array(sig))}`;
}
export async function readMemberToken(token, secret, audience, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 4096) throw unauthorized();
    const parts = token.split('.');
    if (parts.length !== 2 || !await crypto.subtle.verify('HMAC', await key(secret), decode(parts[1]), encoder.encode(parts[0]))) throw unauthorized();
    const value = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if (value.aud !== audience || !Number.isFinite(value.exp) || value.exp <= now ||
        value.exp > now + 3600000) throw unauthorized();
    return value;
  } catch { throw unauthorized(); }
}
const responseHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
function redirect(location, cookie) {
  return new Response(null, { status: 302, headers: { ...responseHeaders, Location: location, ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
}
const clearCookie = `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
function siteUrl(env) {
  const url = new URL(env.MEMBER_SITE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw unavailable();
  return url;
}
async function providerJson(url, options) {
  try {
    const result = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!result.ok) throw unavailable();
    return await result.json();
  } catch { throw unavailable(); }
}
export async function authorizeMember(request, env) {
  if (env.MEMBER_LOGIN_METHOD === 'supabase') return authorizeManagedMember(request, env);
  if (!memberReady(env)) throw unavailable();
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) throw unauthorized();
  const session = await readMemberToken(header.slice(7), env.MEMBER_SESSION_SECRET, 'member');
  return verifyPaidSubscription({ subscriptionId: session.subscriptionId, payerId: session.payerId }, env);
}
export async function handleMemberRoute(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/member/status') {
    return new Response(JSON.stringify({ ready: memberReady(env), enforced: env.MEMBERSHIP_ENFORCED === 'true', ...(env.MEMBER_LOGIN_METHOD === 'supabase' ? { method: 'supabase' } : {}) }),
      { headers: { ...responseHeaders, 'Content-Type': 'application/json' } });
  }
  if (['/api/member/config', '/api/member/account', '/api/member/link'].includes(url.pathname)) {
    const result = await handleManagedRoute(request, env);
    return new Response(JSON.stringify(result), { headers: { ...responseHeaders, 'Content-Type': 'application/json' } });
  }
  if (!memberReady(env) || env.MEMBER_LOGIN_METHOD === 'supabase') throw unavailable();
  if (url.pathname === '/api/member/start') {
    const subscriptionId = url.searchParams.get('subscription_id') || '';
    if (!/^I-[A-Z0-9]{6,64}$/.test(subscriptionId)) throw new MembershipError('invalid_subscription', 400, 'Enter the subscription ID from PayPal.');
    const callback = new URL(env.MEMBER_CALLBACK_URL);
    if (callback.protocol !== 'https:' || callback.origin !== url.origin || callback.pathname !== '/api/member/callback') throw unavailable();
    const nonce = encode(crypto.getRandomValues(new Uint8Array(32)));
    const state = await signMemberToken({ aud: 'login', exp: Date.now() + 600000, nonce, subscriptionId }, env.MEMBER_SESSION_SECRET);
    const auth = new URL(env.PAYPAL_ENVIRONMENT === 'live' ? 'https://www.paypal.com/connect' : 'https://www.sandbox.paypal.com/connect');
    auth.search = new URLSearchParams({ flowEntry: 'static', client_id: env.PAYPAL_CLIENT_ID,
      response_type: 'code', scope: 'openid https://uri.paypal.com/services/paypalattributes',
      redirect_uri: callback.href, state }).toString();
    return redirect(auth.href, `${cookieName}=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  }
  if (url.pathname === '/api/member/callback') {
    const destination = siteUrl(env);
    try {
      const state = await readMemberToken(url.searchParams.get('state'), env.MEMBER_SESSION_SECRET, 'login');
      const cookie = (request.headers.get('Cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`));
      if (!cookie || cookie.slice(cookieName.length + 1) !== state.nonce || !state.nonce) throw unauthorized();
      const code = url.searchParams.get('code');
      if (url.searchParams.has('error') || !code || code.length > 4096) throw unauthorized();
      const base = env.PAYPAL_ENVIRONMENT === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
      const token = await providerJson(`${base}/v1/oauth2/token`, { method: 'POST',
        headers: { Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: env.MEMBER_CALLBACK_URL }).toString() });
      if (!token.access_token) throw unavailable();
      const identity = await providerJson(`${base}/v1/identity/oauth2/userinfo?schema=paypalv1.1`,
        { headers: { Authorization: `Bearer ${token.access_token}` } });
      const payerId = identity.payer_id;
      await verifyPaidSubscription({ subscriptionId: state.subscriptionId, payerId }, env);
      const session = await signMemberToken({ aud: 'member', exp: Date.now() + 3600000,
        subscriptionId: state.subscriptionId, payerId }, env.MEMBER_SESSION_SECRET);
      destination.hash = new URLSearchParams({ member_token: session }).toString();
    } catch (error) {
      destination.hash = new URLSearchParams({ member_error: error instanceof MembershipError ? error.code : 'membership_unavailable' }).toString();
    }
    return redirect(destination.href, clearCookie);
  }
  throw new MembershipError('not_found', 404, 'Endpoint not found.');
}
