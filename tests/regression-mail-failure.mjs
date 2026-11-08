import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from '../backend/worker.mjs';

test('only authentic recent Resend sign-in failures generate an operator alert', async t => {
  const key = Buffer.from('fictional test signing secret');
  const sent = [];
  const env = { OPERATOR_ALERTS: {send: async message => sent.push(message)}, RESEND_WEBHOOK_SECRET: 'whsec_' + key.toString('base64') };
  const logger = t.mock.method(console, 'error', () => {});
  async function post(from, type, ageSeconds = 0, tamper = false) {
    const body = JSON.stringify({ type, data: { from, to: ['fictional@example.invalid'] } });
    const time = String(Math.floor(Date.now() / 1000) - ageSeconds);
    const id = 'test-event';
    const signature = createHmac('sha256', key).update([id,time,body].join('.')).digest('base64');
    return worker.fetch(new Request('https://worker.example/api/events/sign-in-email', {
      method: 'POST', body: tamper ? body + ' ' : body,
      headers: { 'svix-id': id, 'svix-timestamp': time, 'svix-signature': 'v1,' + signature }
    }), env);
  }
  const sender = 'A to Z Wise AI <login@mail.atozwiseai.com>';
  assert.equal((await post(sender, 'email.failed', 0, true)).status, 401);
  assert.equal((await post(sender, 'email.failed', 600)).status, 401);
  assert.equal((await post('support@atozwiseai.com', 'email.failed')).status, 204);
  assert.equal((await post(sender, 'email.delivered')).status, 204);
  assert.equal(logger.mock.callCount(), 0);
  assert.equal(sent.length, 0);
  for (const type of ['email.bounced', 'email.failed', 'email.suppressed', 'email.delivery_delayed']) {
    assert.equal((await post(sender, type)).status, 204);
    assert.equal(sent.at(-1).to, null);
    assert.ok(!sent.at(-1).text.includes('fictional@example.invalid'));
    assert.deepEqual(logger.mock.calls.at(-1).arguments, ['Member sign-in email delivery issue: ' + type]);
  }
});
