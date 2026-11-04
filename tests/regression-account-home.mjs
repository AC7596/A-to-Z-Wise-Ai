import test from 'node:test';
import assert from 'node:assert/strict';
import { bindAccountHome } from '../js/modules/account-home.js';
import { updateHomeInfo, loadMyHomeProfile, exportMyHomeProfile } from '../js/modules/my-home-store.js';
function fixture(){
 const map=new Map();const storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 const elements=Object.fromEntries(['cloudSave','cloudLoad','cloudDownload'].map(id=>[id,{disabled:false}]));
 const messages=[];const user={id:'user-a',email:'a@example.com'};let account=user,record=null,result=[],writes=0;
 const client={auth:{getUser:async()=>({data:{user:account}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:record})})})}),rpc:async(name,args)=>{writes++;assert.equal(args.expected_user_id,user.id);return {data:result};}};
 globalThis.window={localStorage:storage};globalThis.document={getElementById:id=>elements[id],createElement:()=>({click(){}})};globalThis.confirm=()=>true;
 bindAccountHome(client,user,m=>messages.push(m));
 return {storage,elements,messages,setAccount:x=>{account=x;},setRecord:x=>{record=x;},setResult:x=>{result=x;},writes:()=>writes};
}
test('cloud saves require same signed-in account and protect stale revisions',async()=>{
 const f=fixture();updateHomeInfo({nickname:'Fictional home'},f.storage);
 await f.elements.cloudSave.onclick();assert.match(f.messages.at(-1),/Another device/);
 f.setResult([{revision:1}]);await f.elements.cloudSave.onclick();assert.match(f.messages.at(-1),/Saved/);
 f.setAccount({id:'user-b'});const before=f.writes();await f.elements.cloudSave.onclick();assert.equal(f.writes(),before);assert.match(f.messages.at(-1),/account changed/);
});
test('existing cloud record requires review before overwriting',async()=>{
 const f=fixture();f.setRecord({revision:4,profile:{}});await f.elements.cloudSave.onclick();assert.equal(f.writes(),0);assert.match(f.messages.at(-1),/already exists/);
});
test('cloud restore imports a valid profile and rejects damaged data',async()=>{
 const f=fixture();updateHomeInfo({nickname:'Fictional cloud home'},f.storage);const profile=JSON.parse(exportMyHomeProfile(f.storage));updateHomeInfo({nickname:'Local before restore'},f.storage);
 f.setRecord({revision:2,profile});await f.elements.cloudLoad.onclick();assert.equal(loadMyHomeProfile(f.storage).homeInfo.nickname,'Fictional cloud home');
 f.setRecord({revision:3,profile:{appId:'a-to-z-wise-ai-my-home'}});await f.elements.cloudLoad.onclick();assert.equal(loadMyHomeProfile(f.storage).homeInfo.nickname,'Fictional cloud home');assert.match(f.messages.at(-1),/not a recognized/);
});
