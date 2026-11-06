import { getAccountClient, accountRequest } from '../api/account-client.js';
import { bindAccountHome } from './account-home.js?v=private-home-2';
const el=id=>document.getElementById(id);
const status=message=>{el('memberStatus').textContent=message;};
let client, email='', cooldownUntil=0, activeUser='';
const subscription=new URLSearchParams(location.search).get('subscription_id');
if(location.search||location.hash)history.replaceState(null,'',location.pathname);
if(/^I-[A-Z0-9]{6,64}$/.test(subscription||''))el('subscriptionId').value=subscription;
async function showAccount(){
 el('startDiagnosis').hidden=true;
 el('subscriptionLinkForm').hidden=true;
 const {data,error}=await client.auth.getUser();
 if(error||!data.user){activeUser='';el('accountDetails').hidden=true;el('memberLoginForm').hidden=false;return;}
 activeUser=data.user.id;el('memberLoginForm').hidden=true;el('memberCodeForm').hidden=true;el('accountDetails').hidden=false;
 el('accountEmail').textContent=data.user.email;status('You are signed in.');
 bindAccountHome(client,data.user,message=>{el('cloudStatus').textContent=message;});
 try{const membership=await accountRequest('account');
 el('subscriptionLinkForm').hidden=membership.linked;
 el('startDiagnosis').hidden=!membership.active;
 el('membershipStatus').textContent=membership.active?'Your paid membership is active.':membership.linked?'Your subscription is linked, but payment is not currently active. Check PayPal billing; do not subscribe again.':'No subscription linked yet. Already paid? Link it below once.';
 }catch(error){el('membershipStatus').textContent=error.message;}
}
el('memberLoginForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!client||Date.now()<cooldownUntil)return;el('memberLoginButton').disabled=true;
 email=el('memberEmail').value.trim();
 try{const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:true}});if(error)throw error;
 cooldownUntil=Date.now()+60000;el('memberCodeForm').hidden=false;status('Check your email for a sign-in code. You can request another code in one minute.');el('memberCode').focus();
 setTimeout(()=>{el('memberLoginButton').disabled=false;},60000);
 }catch{status('Could not send a code. Please wait a minute and try again.');el('memberLoginButton').disabled=false;}
});
el('memberCodeForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=el('memberCodeForm').querySelector('button');button.disabled=true;
 try{const {error}=await client.auth.verifyOtp({email,token:el('memberCode').value.trim(),type:'email'});if(error)throw error;el('memberCode').value='';await showAccount();}
 catch{status('That code could not be verified. Check it or request a new one.');}finally{button.disabled=false;}
});
el('subscriptionLinkForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=el('subscriptionLinkForm').querySelector('button');button.disabled=true;
 try{await accountRequest('link',{subscriptionId:el('subscriptionId').value.trim().toUpperCase()});await showAccount();}
 catch(error){el('membershipStatus').textContent=error.message;}finally{button.disabled=false;}
});
el('memberLogout').addEventListener('click',async()=>{
 const {error}=await client.auth.signOut({scope:'local'});if(error){status('Could not sign out. Please try again.');return;}
 el('accountDetails').hidden=true;el('memberLoginForm').hidden=false;el('cloudStatus').textContent='';el('accountEmail').textContent='';el('membershipStatus').textContent='';status('Signed out. Local home records remain on this device.');activeUser='';
});
try{client=await getAccountClient();if(!client){status('Account sign-in and cloud storage are being set up. Current public tools remain available. Do not subscribe again.');}
else{el('memberLoginButton').disabled=false;status('Enter your email to sign in or create an account.');await showAccount();
client.auth.onAuthStateChange((event,session)=>{if(activeUser&&session?.user?.id!==activeUser){el('accountDetails').hidden=true;status('Your account changed in another tab. Reload this page to continue.');}});}}
catch{status('Account services are temporarily unavailable. Please try again later.');}
