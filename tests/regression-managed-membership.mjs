import test from 'node:test';
import assert from 'node:assert/strict';
import { managedUser, managedReady, handleManagedRoute, authorizeManagedMember } from '../backend/managed-membership.mjs';
import worker from '../backend/worker.mjs';
const id='12345678-1234-1234-1234-123456789abc';
function fixture(){
 const env={MEMBER_LOGIN_METHOD:'supabase',MANAGED_ACCOUNTS_ENABLED:'true',SUPABASE_URL:'https://test-project.supabase.co',SUPABASE_PUBLIC_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'private-test',PAYPAL_CLIENT_ID:'test',PAYPAL_CLIENT_SECRET:'test',PAYPAL_PLAN_ID:'P-TEST',PAYPAL_ENVIRONMENT:'sandbox',ALLOWED_ORIGINS:'https://atozwiseai.com'};
 const user={id,email:'buyer@example.com',email_confirmed_at:'2026-11-01',is_anonymous:false};
 const record={id:'I-TEST123456',plan_id:'P-TEST',status:'ACTIVE',subscriber:{payer_id:'TESTPAYER1234',email_address:user.email},billing_info:{last_payment:{time:new Date(Date.now()-10000).toISOString(),amount:{currency_code:'USD',value:'9.99'}},next_billing_time:new Date(Date.now()+86400000).toISOString()}};
 let link=null, authStatus=200, conflict=false; const calls=[];
 const fetchImpl=async(url,options={})=>{
 calls.push({url,options});
 if(url.endsWith('/rpc/allow_member_link'))return Response.json(true);
 if(url.endsWith('/auth/v1/user'))return Response.json(user,{status:authStatus});
 if(url.includes('/rest/v1/member_subscriptions')){
 if(options.method==='POST'){if(conflict)return new Response('',{status:409});link=JSON.parse(options.body);return new Response(null,{status:204});}
 return Response.json(link?[link]:[]);}
 if(url.endsWith('/token'))return Response.json({access_token:'test-token'});
 return Response.json(record);
 };
 const req=(path='account',body)=>new Request('https://backend.example/api/member/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer verified.token',Origin:'https://atozwiseai.com','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 return {env,user,record,calls,fetchImpl,req,setLink:v=>{link=v;},getLink:()=>link,setAuth:v=>{authStatus=v;},conflict:()=>{conflict=true;}};
}
test('managed login requires configuration and verified nonanonymous user',async()=>{
 const f=fixture();assert.equal(managedReady(f.env),true);assert.equal(managedReady({...f.env,SUPABASE_SERVICE_ROLE_KEY:''}),false);
 assert.equal((await managedUser(f.req(),f.env,f.fetchImpl)).id,id);
 f.user.email_confirmed_at=null;await assert.rejects(managedUser(f.req(),f.env,f.fetchImpl),{status:401});
 f.user.email_confirmed_at='2026-11-01';f.user.is_anonymous=true;await assert.rejects(managedUser(f.req(),f.env,f.fetchImpl),{status:401});
});
test('forged and expired sessions rejected by provider before billing access',async()=>{
 const f=fixture();f.setAuth(401);await assert.rejects(authorizeManagedMember(f.req(),f.env,f.fetchImpl),{status:401});assert.equal(f.calls.length,1);
});
test('public configuration never exposes server keys',async()=>{
 const f=fixture();const config=await handleManagedRoute(f.req('config'),f.env,f.fetchImpl);
 assert.equal(config.publicKey,'public-test');assert.ok(!JSON.stringify(config).includes('private-test'));assert.equal(f.calls.length,0);
});
test('link uses verified email and user ID, ignores client identity fields',async()=>{
 const f=fixture();await handleManagedRoute(f.req('link',{subscriptionId:f.record.id,email:'attacker@example.com',user_id:'attacker',payerId:'attacker'}),f.env,f.fetchImpl);
 assert.equal(f.getLink().user_id,id);assert.equal(f.getLink().payer_id,f.record.subscriber.payer_id);
 const result=await authorizeManagedMember(f.req(),f.env,f.fetchImpl);assert.equal(result.active,true);
});
test('another payer email cannot be linked',async()=>{
 const f=fixture();f.user.email='attacker@example.com';await assert.rejects(handleManagedRoute(f.req('link',{subscriptionId:f.record.id}),f.env,f.fetchImpl),{code:'membership_required'});assert.equal(f.getLink(),null);
});
test('database ownership conflict cannot overwrite another account',async()=>{
 const f=fixture();f.conflict();await assert.rejects(handleManagedRoute(f.req('link',{subscriptionId:f.record.id}),f.env,f.fetchImpl),{code:'subscription_already_linked'});assert.equal(f.getLink(),null);
});
test('linked account signs in again without supplying subscription ID',async()=>{
 const f=fixture();f.setLink({user_id:id,subscription_id:f.record.id,payer_id:f.record.subscriber.payer_id});
 assert.equal((await handleManagedRoute(f.req(),f.env,f.fetchImpl)).active,true);
 assert.equal((await authorizeManagedMember(f.req(),f.env,f.fetchImpl)).active,true);
 f.record.status='CANCELLED';assert.equal((await handleManagedRoute(f.req(),f.env,f.fetchImpl)).active,false);
 await assert.rejects(authorizeManagedMember(f.req(),f.env,f.fetchImpl),{code:'membership_required'});
});
test('unlinked account has no paid access',async()=>{
 const f=fixture();assert.equal((await handleManagedRoute(f.req(),f.env,f.fetchImpl)).linked,false);
 await assert.rejects(authorizeManagedMember(f.req(),f.env,f.fetchImpl),{code:'membership_required'});
});
test('worker routes methods and preflight for managed accounts',async()=>{
 const f=fixture();const original=globalThis.fetch;globalThis.fetch=f.fetchImpl;
 try{
 assert.equal((await worker.fetch(f.req('config'),f.env)).status,200);
 assert.equal((await worker.fetch(f.req('link'),f.env)).status,405);
 const preflight=await worker.fetch(new Request('https://backend.example/api/member/link',{method:'OPTIONS',headers:{Origin:f.env.ALLOWED_ORIGINS}}),f.env);
 assert.match(preflight.headers.get('Access-Control-Allow-Methods'),/POST/);
 const response=await worker.fetch(f.req('link',{subscriptionId:f.record.id}),f.env);assert.equal(response.status,200);
 }finally{globalThis.fetch=original;}
});
