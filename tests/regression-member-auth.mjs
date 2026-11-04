import test from 'node:test';
import assert from 'node:assert/strict';
import { signMemberToken, readMemberToken, handleMemberRoute, authorizeMember } from '../backend/member-auth.mjs';
import worker from '../backend/worker.mjs';
import { buildDiagnosisRequest } from '../js/api/diagnosis-contract.js';
const secret = 'test-session-secret-that-is-at-least-32-bytes';
const env = { MEMBER_SESSION_SECRET: secret, PAYPAL_CLIENT_ID: 'test-client', PAYPAL_CLIENT_SECRET: 'test-secret',
  PAYPAL_PLAN_ID: 'P-TEST', PAYPAL_ENVIRONMENT: 'sandbox', PAYPAL_LOGIN_APPROVED: 'true',
  MEMBER_CALLBACK_URL: 'https://backend.example/api/member/callback', MEMBER_SITE_URL: 'https://site.example/member.html' };
test('sessions reject tampering, expired tokens and login-state tokens', async () => {
  const token = await signMemberToken({ aud: 'member', exp: Date.now() + 60000, payerId: 'TESTPAYER1234' }, secret);
  assert.equal((await readMemberToken(token, secret, 'member')).payerId, 'TESTPAYER1234');
  await assert.rejects(readMemberToken(token + 'x', secret, 'member'));
  await assert.rejects(readMemberToken(token, secret, 'login'));
  await assert.rejects(readMemberToken(token, secret, 'member', Date.now() + 120000));
  await assert.rejects(readMemberToken('anything', secret, 'member'));
});
test('login binds state to a secure browser cookie', async () => {
  const result = await handleMemberRoute(new Request('https://backend.example/api/member/start?subscription_id=I-TEST123456'), env);
  const target = new URL(result.headers.get('Location'));
  assert.equal(target.origin, 'https://www.sandbox.paypal.com');
  const state = await readMemberToken(target.searchParams.get('state'), secret, 'login');
  assert.equal(state.subscriptionId, 'I-TEST123456');
  assert.ok(result.headers.get('Set-Cookie').includes(`=${state.nonce};`));
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax']) assert.ok(result.headers.get('Set-Cookie').includes(flag));
});
test('callback without matching browser cookie does not authenticate', async () => {
  const state = await signMemberToken({ aud: 'login', exp: Date.now() + 60000, nonce: 'nonce', subscriptionId: 'I-TEST123456' }, secret);
  const result = await handleMemberRoute(new Request(`https://backend.example/api/member/callback?code=fake&state=${state}`), env);
  const url = new URL(result.headers.get('Location'));
  assert.equal(url.origin, 'https://site.example');
  assert.ok(url.hash.includes('member_error='));
  assert.ok(!url.hash.includes('member_token='));
});
test('unsigned bearer cannot authorize a diagnosis', async () => {
  await assert.rejects(authorizeMember(new Request('https://backend.example/api/diagnose', { headers: { Authorization: 'Bearer fake' } }), env), { status: 401 });
});
test('member readiness fails closed without approval', async () => {
  const result = await handleMemberRoute(new Request('https://backend.example/api/member/status'), {});
  assert.deepEqual(await result.json(), { ready: false, enforced: false });
});
test('worker advertises and serves membership status', async () => {
  const result = await worker.fetch(new Request('https://backend.example/api/member/status'), {});
  assert.equal(result.status, 200);
  assert.equal((await result.json()).ready, false);
});
test('enforced diagnosis rejects a nonmember before any provider call', async () => {
  const request = new Request('https://backend.example/api/diagnose', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildDiagnosisRequest({ category: 'Plumbing', problem: 'Faucet drips slowly.' })) });
  const result = await worker.fetch(request, { ...env, MEMBERSHIP_ENFORCED: 'true' });
  assert.equal(result.status, 401);
  assert.equal((await result.json()).error, 'member_login_required');
});
test('enforced diagnosis preserves free immediate danger guidance', async () => {
  const request = new Request('https://backend.example/api/diagnose', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildDiagnosisRequest({ category: 'Electrical', problem: 'Smoke and sparking from an outlet.' })) });
  const result = await worker.fetch(request, { ...env, MEMBERSHIP_ENFORCED: 'true' });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).hasDanger, true);
});
test('complete callback verifies PayPal identity and subscription before issuing a session', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'test-token' });
    if (url.includes('/userinfo?')) return Response.json({ payer_id: 'TESTPAYER1234' });
    return Response.json({ id: 'I-TEST123456', plan_id: 'P-TEST', status: 'ACTIVE',
      subscriber: { payer_id: 'TESTPAYER1234' }, billing_info: {
        last_payment: { time: new Date(Date.now() - 60000).toISOString(), amount: { currency_code: 'USD', value: '9.99' } },
        next_billing_time: new Date(Date.now() + 86400000).toISOString(), failed_payments_count: 0
      } });
  };
  try {
    const state = await signMemberToken({ aud: 'login', exp: Date.now() + 60000,
      nonce: 'test-nonce', subscriptionId: 'I-TEST123456' }, secret);
    const result = await handleMemberRoute(new Request(`https://backend.example/api/member/callback?code=test-code&state=${state}`,
      { headers: { Cookie: '__Host-atoz_member_state=test-nonce' } }), env);
    const fragment = new URLSearchParams(new URL(result.headers.get('Location')).hash.slice(1));
    const session = await readMemberToken(fragment.get('member_token'), secret, 'member');
    assert.equal(session.payerId, 'TESTPAYER1234');
    assert.equal(session.subscriptionId, 'I-TEST123456');
    assert.equal(calls.length, 4);
    assert.ok(result.headers.get('Set-Cookie').includes('Max-Age=0'));
    assert.ok(!fragment.has('access_token'));
  } finally { globalThis.fetch = originalFetch; }
});
