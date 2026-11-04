import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { handleEmailMember } from '../backend/email-member.mjs';
import { handleMemberRoute, readMemberToken } from '../backend/member-auth.mjs';
function setup() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(fs.readFileSync(new URL('../backend/migrations/0001_member_email.sql', import.meta.url), 'utf8'));
  const db = { prepare: query => ({ bind: (...args) => ({ first: async () => sql.prepare(query).get(...args), run: async () => sql.prepare(query).run(...args) }) }) };
  const env = { MEMBER_LOGIN_METHOD: 'email', EMAIL_LOGIN_ENABLED: 'true', MEMBER_DB: db,
    RESEND_API_KEY: 'test-only', MEMBER_EMAIL_FROM: 'test@example.com', MEMBER_SESSION_SECRET: 'test'.repeat(16),
    PAYPAL_CLIENT_ID: 'test', PAYPAL_CLIENT_SECRET: 'test', PAYPAL_PLAN_ID: 'P-TEST', PAYPAL_ENVIRONMENT: 'sandbox', ALLOWED_ORIGINS: 'https://atozwiseai.com' };
  const now = Date.now();
  const record = { id: 'I-TEST123456', plan_id: 'P-TEST', status: 'ACTIVE', subscriber: { payer_id: 'TESTPAYER1234', email_address: 'buyer@example.com' }, billing_info: { last_payment: { time: new Date(now-10000).toISOString(), amount: { value: '9.99', currency_code: 'USD' } }, next_billing_time: new Date(now+86400000).toISOString() } };
  const emails = [];
  const fetchImpl = async (url, options) => {
    if(url === 'https://api.resend.com/emails') { emails.push(JSON.parse(options.body)); return Response.json({id:'test-email'}); }
    return Response.json(url.endsWith('/token') ? {access_token:'test'} : record);
  };
  const body = { email: 'buyer@example.com', subscriptionId: record.id, browserNonce: 'a'.repeat(64) };
  const req = (route, value, origin = env.ALLOWED_ORIGINS) => new Request('https://backend.example/api/member/email/'+route, { method:'POST', headers:{Origin:origin, 'Content-Type':'application/json'}, body:JSON.stringify(value) });
  const start = () => handleEmailMember(req('start',body),env,{fetchImpl,now});
  const proof = id => ({challengeId:id,browserNonce:body.browserNonce,code:emails.at(-1).text.match(/\b[a-f0-9]{32}\b/)[0]});
  return {env,now,record,emails,fetchImpl,body,req,start,proof,sql};
}
test('email proof authenticates once, rechecks payment, and stores only code hashes', async()=>{
  const f=setup(); const start=await f.start();
  assert.equal(f.emails[0].to[0],f.body.email);
  const proof=f.proof(start.challengeId);
  assert.ok(!JSON.stringify(f.sql.prepare('SELECT * FROM member_email_challenges').all()).includes(proof.code));
  const result=await handleEmailMember(f.req('verify',proof),f.env,{fetchImpl:f.fetchImpl,now:f.now});
  assert.equal(result.membership.active,true);
  await assert.rejects(handleEmailMember(f.req('verify',proof),f.env,{fetchImpl:f.fetchImpl,now:f.now}),{code:'email_login_failed'});
});
for(const kind of ['wrong code','wrong browser','expired','canceled']) test('rejects '+kind,async()=>{
  const f=setup(); const start=await f.start(); const proof=f.proof(start.challengeId);
  if(kind==='wrong code')proof.code='0'.repeat(32);
  if(kind==='wrong browser')proof.browserNonce='b'.repeat(64);
  if(kind==='canceled')f.record.status='CANCELLED';
  await assert.rejects(handleEmailMember(f.req('verify',proof),f.env,{fetchImpl:f.fetchImpl,now:f.now+(kind==='expired'?600001:0)}));
});
test('wrong email gets generic response but no email or challenge',async()=>{
  const f=setup(); f.body.email='attacker@example.com';
  const result=await f.start(); assert.ok(result.challengeId); assert.equal(f.emails.length,0);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM member_email_challenges').get().n,0);
});
test('limits repeated mail requests',async()=>{
  const f=setup(); for(let i=0;i<5;i++)await f.start();
  await assert.rejects(f.start(),{code:'too_many_requests'}); assert.equal(f.emails.length,5);
});
test('failed mail delivery removes the unusable challenge',async()=>{
  const f=setup(); const transport=(url,opts)=>url.includes('resend.com')?Promise.resolve(new Response('',{status:500})):f.fetchImpl(url,opts);
  await assert.rejects(handleEmailMember(f.req('start',f.body),f.env,{fetchImpl:transport,now:f.now}),{code:'membership_unavailable'});
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM member_email_challenges').get().n,0);
});
test('requires configured email service and allowed origin',async()=>{
  const f=setup(); await assert.rejects(handleEmailMember(f.req('start',f.body,'https://evil.example'),f.env),{code:'origin_denied'});
  await assert.rejects(handleEmailMember(f.req('start',f.body),{...f.env,RESEND_API_KEY:''}),{code:'membership_unavailable'});
});
test('full email route returns a signed member session without PayPal OAuth approval',async()=>{
  const f=setup(); const original=globalThis.fetch; globalThis.fetch=f.fetchImpl;
  try {const start=await (await handleMemberRoute(f.req('start',f.body),f.env)).json();
    const result=await (await handleMemberRoute(f.req('verify',f.proof(start.challengeId)),f.env)).json();
    const session=await readMemberToken(result.memberToken,f.env.MEMBER_SESSION_SECRET,'member');
    assert.equal(session.subscriptionId,f.record.id);assert.equal(session.payerId,f.record.subscriber.payer_id);
  } finally {globalThis.fetch=original;}
});
