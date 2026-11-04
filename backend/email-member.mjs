import { MembershipError, findSubscriptionForEmail, verifyPaidSubscription } from './paypal-membership.mjs';

const fail = () => new MembershipError('email_login_failed', 401, 'That code is invalid or expired. Request a new code and use the same browser tab.');
const unavailable = () => new MembershipError('membership_unavailable', 503, 'Email sign-in is being set up. You do not need to subscribe again.');
const encode = value => new TextEncoder().encode(value);
async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export function emailMemberReady(env) {
  return env.MEMBER_LOGIN_METHOD === 'email' && env.EMAIL_LOGIN_ENABLED === 'true' &&
    Boolean(env.MEMBER_DB && env.RESEND_API_KEY && env.MEMBER_EMAIL_FROM &&
      env.MEMBER_SESSION_SECRET?.length >= 32 && env.PAYPAL_CLIENT_ID &&
      env.PAYPAL_CLIENT_SECRET && env.PAYPAL_PLAN_ID && ['live', 'sandbox'].includes(env.PAYPAL_ENVIRONMENT));
}
async function limit(db, key, maximum, now) {
  const bucket = Math.floor(now / 3600000);
  const row = await db.prepare(`INSERT INTO member_email_limits (key, bucket, count) VALUES (?, ?, 1)
    ON CONFLICT(key, bucket) DO UPDATE SET count = count + 1 RETURNING count`).bind(key, bucket).first();
  if (row.count > maximum) throw new MembershipError('too_many_requests', 429, 'Too many sign-in attempts. Please try again in an hour.');
}
export async function handleEmailMember(request, env, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!emailMemberReady(env)) throw unavailable();
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  if (!origin || !allowed.includes(origin)) throw new MembershipError('origin_denied', 403, 'Open sign-in from the A to Z Wise AI website.');
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw fail();
  const text = await request.text();
  if (text.length > 2048) throw fail();
  let body;
  try { body = JSON.parse(text); } catch { throw fail(); }
  if (!body || typeof body !== 'object' || !/^[a-f0-9]{64}$/.test(body.browserNonce || '')) throw fail();
  const db = env.MEMBER_DB;
  const nonceHash = await hash(body.browserNonce);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // Salt rate-limit identifiers; retain no raw IP or email in the database.
  await limit(db, await hash(`${env.MEMBER_SESSION_SECRET}:ip:${ip}`), 40, now);
  await db.prepare('DELETE FROM member_email_challenges WHERE expires <= ?').bind(now).run();
  await db.prepare('DELETE FROM member_email_limits WHERE bucket < ?').bind(Math.floor(now / 3600000) - 1).run();
  if (new URL(request.url).pathname === '/api/member/email/start') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const subscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId.trim().toUpperCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^I-[A-Z0-9]{6,64}$/.test(subscriptionId)) throw fail();
    await limit(db, await hash(`${env.MEMBER_SESSION_SECRET}:email:${email}`), 5, now);
    const challengeId = crypto.randomUUID();
    const generic = { challengeId, message: 'If these details match an active paid subscription, a code has been sent to that email. Check your inbox and spam folder. It expires in 10 minutes.' };
    let membership;
    try { membership = await findSubscriptionForEmail({ subscriptionId, email }, env, { fetchImpl, now }); }
    catch (error) { if (error.code === 'membership_required') return generic; throw error; }
    // 128-bit code pasted from email, rather than an easily guessed short PIN.
    const code = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    await db.prepare(`INSERT INTO member_email_challenges
      (id, code_hash, nonce_hash, subscription_id, payer_id, expires) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(challengeId, await hash(code), nonceHash, membership.subscriptionId, membership.payerId, now + 600000).run();
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': challengeId },
        body: JSON.stringify({ from: env.MEMBER_EMAIL_FROM, to: [email], subject: 'Your A to Z Wise AI sign-in code',
          text: `Paste this code into the A to Z Wise AI member page in the browser tab where you requested it:\n\n${code}\n\nIt expires in 10 minutes and can be used once. This does not charge you or create a subscription. If you did not request this code, ignore this email. Never share it with anyone.` })
      });
      if (!response.ok) throw unavailable();
    } catch {
      await db.prepare('DELETE FROM member_email_challenges WHERE id = ?').bind(challengeId).run();
      throw unavailable();
    }
    return generic;
  }
  if (new URL(request.url).pathname !== '/api/member/email/verify') throw fail();
  if (!/^[a-f0-9-]{36}$/.test(body.challengeId || '') || !/^[a-f0-9]{32}$/.test(body.code || '')) throw fail();
  // Atomic deletion prevents concurrent reuse. Wrong browser/code cannot consume a valid challenge.
  const challenge = await db.prepare(`DELETE FROM member_email_challenges
    WHERE id = ? AND code_hash = ? AND nonce_hash = ? AND expires > ? RETURNING subscription_id, payer_id`)
    .bind(body.challengeId, await hash(body.code), nonceHash, now).first();
  if (!challenge) throw fail();
  const membership = await verifyPaidSubscription({ subscriptionId: challenge.subscription_id, payerId: challenge.payer_id }, env, { fetchImpl, now });
  return { membership };
}
