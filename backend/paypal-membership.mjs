// Server-only building block. Not enabled in the diagnosis route until
// authenticated member sessions and live integration tests are complete.
export class MembershipError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function unavailable() {
  return new MembershipError('membership_unavailable', 503,
    'Membership verification is temporarily unavailable. Please try again later.');
}

function denied() {
  return new MembershipError('membership_required', 403,
    'A matching active paid Founding Member subscription is required.');
}

async function paypalJson(fetchImpl, url, options) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...options, redirect: 'manual', signal: AbortSignal.timeout(10000)
    });
  } catch { throw unavailable(); }
  if (response.status === 404) throw denied();
  if (!response.ok) throw unavailable();
  try { return await response.json(); } catch { throw unavailable(); }
}

// payerId MUST come from a verified server-side login session, never from
// request JSON, a query parameter, an email address, or a checkout return URL.
export async function verifyPaidSubscription({ subscriptionId, payerId }, env,
  { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!/^I-[A-Z0-9]{6,64}$/.test(subscriptionId || '') ||
      !/^[A-Z0-9]{13}$/.test(payerId || '')) throw denied();
  return checkSubscription(subscriptionId, subscriber => subscriber?.payer_id === payerId, env, { fetchImpl, now });
}

// This only locates the subscription for an email challenge. It does NOT
// authenticate the caller. Send proof only to this matching PayPal address.
export async function findSubscriptionForEmail({ subscriptionId, email }, env,
  { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!/^I-[A-Z0-9]{6,64}$/.test(subscriptionId || '') ||
      typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw denied();
  return checkSubscription(subscriptionId, subscriber =>
    subscriber?.email_address?.trim().toLowerCase() === email.trim().toLowerCase() &&
    /^[A-Z0-9]{13}$/.test(subscriber?.payer_id || ''), env, { fetchImpl, now });
}

async function checkSubscription(subscriptionId, matchesIdentity, env, { fetchImpl, now }) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET || !env.PAYPAL_PLAN_ID ||
      !['live', 'sandbox'].includes(env.PAYPAL_ENVIRONMENT)) throw unavailable();
  const base = env.PAYPAL_ENVIRONMENT === 'live'
    ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const token = await paypalJson(fetchImpl, `${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (typeof token.access_token !== 'string' || !token.access_token) throw unavailable();
  const record = await paypalJson(fetchImpl,
    `${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' }
    });
  const paid = record.billing_info?.last_payment;
  const paidAt = Date.parse(paid?.time);
  const nextBill = Date.parse(record.billing_info?.next_billing_time);
  // This initial policy has no free trials or overdue-payment grace period.
  // Reject missing payment evidence, future payments, and overdue billing.
  if (record.id !== subscriptionId || record.plan_id !== env.PAYPAL_PLAN_ID ||
      record.status !== 'ACTIVE' || !matchesIdentity(record.subscriber) ||
      paid?.amount?.currency_code !== 'USD' || !(Number(paid?.amount?.value) > 0) ||
      !Number.isFinite(paidAt) || paidAt > now ||
      !Number.isFinite(nextBill) || nextBill <= now ||
      Number(record.billing_info?.failed_payments_count || 0) > 0) throw denied();
  // Do not return names, email addresses, or payment credentials to the client.
  return { subscriptionId, payerId: record.subscriber.payer_id, active: true, verifiedAt: now };
}
