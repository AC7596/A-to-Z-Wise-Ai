import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPaidSubscription } from '../backend/paypal-membership.mjs';

const env = { PAYPAL_CLIENT_ID: 'test-client', PAYPAL_CLIENT_SECRET: 'test-secret',
  PAYPAL_PLAN_ID: 'P-TEST', PAYPAL_ENVIRONMENT: 'sandbox' };
const identity = { subscriptionId: 'I-TEST123456', payerId: 'TESTPAYER1234' };
const now = Date.parse('2026-11-03T12:00:00Z');
const record = () => ({ id: identity.subscriptionId, plan_id: env.PAYPAL_PLAN_ID,
  status: 'ACTIVE', subscriber: { payer_id: identity.payerId }, billing_info: {
    last_payment: { time: '2026-11-02T12:00:00Z', amount: { currency_code: 'USD', value: '9.99' } },
    next_billing_time: '2026-12-02T12:00:00Z', failed_payments_count: 0
  } });
function transport(value) {
  return async url => new Response(JSON.stringify(url.endsWith('/token')
    ? { access_token: 'test-access-token' } : value));
}
test('verified customer with matching paid subscription is allowed', async () => {
  assert.equal((await verifyPaidSubscription(identity, env,
    { now, fetchImpl: transport(record()) })).active, true);
});
for (const [label, change] of [
  ['another customer', r => { r.subscriber.payer_id = 'OTHERPAYER123'; }],
  ['another plan', r => { r.plan_id = 'P-OTHER'; }],
  ['canceled subscription', r => { r.status = 'CANCELLED'; }],
  ['pending approval', r => { r.status = 'APPROVAL_PENDING'; }],
  ['missing payment', r => { delete r.billing_info.last_payment; }],
  ['zero payment', r => { r.billing_info.last_payment.amount.value = '0'; }],
  ['future payment', r => { r.billing_info.last_payment.time = '2099-01-01'; }],
  ['overdue billing', r => { r.billing_info.next_billing_time = '2026-11-01'; }],
  ['failed renewal', r => { r.billing_info.failed_payments_count = 1; }]
]) test(`rejects ${label}`, async () => {
  const value = record(); change(value);
  await assert.rejects(verifyPaidSubscription(identity, env,
    { now, fetchImpl: transport(value) }), { code: 'membership_required' });
});
test('untrusted identity is rejected before contacting PayPal', async () => {
  await assert.rejects(verifyPaidSubscription({ ...identity, payerId: '' }, env,
    { fetchImpl: () => { throw new Error('must not fetch'); } }), { code: 'membership_required' });
});
test('missing setup fails closed', async () => {
  await assert.rejects(verifyPaidSubscription(identity, {}), { code: 'membership_unavailable' });
});
test('provider outage does not grant access or expose its response', async () => {
  await assert.rejects(verifyPaidSubscription(identity, env,
    { fetchImpl: async () => new Response('private upstream details', { status: 500 }) }),
    { code: 'membership_unavailable' });
});
