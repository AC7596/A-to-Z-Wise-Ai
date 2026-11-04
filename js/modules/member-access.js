import { getMemberToken, setMemberToken, clearMemberToken } from '../api/member-session.js';
const backend = 'https://a-to-z-wise-ai-backend.ad9259465.workers.dev';
const status = document.getElementById('memberStatus');
const form = document.getElementById('memberLoginForm');
const button = document.getElementById('memberLoginButton');
const logout = document.getElementById('memberLogout');
const input = document.getElementById('subscriptionId');
const fragment = new URLSearchParams(location.hash.slice(1));
const query = new URLSearchParams(location.search);
const returned = fragment.get('member_token');
const failure = fragment.get('member_error');
const subscription = query.get('subscription_id');
// Remove callback values before any subsequent navigation or resource requests.
if (location.hash || location.search) history.replaceState(null, '', location.pathname);
if (/^I-[A-Z0-9]{6,64}$/.test(subscription || '')) input.value = subscription;
let storageFailed = false;
if (returned && returned.length <= 4096 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(returned)) storageFailed = !setMemberToken(returned);
function showSession() {
  const signedIn = Boolean(getMemberToken());
  logout.hidden = !signedIn;
  if (signedIn) status.textContent = 'Sign-in session saved. You can now request a diagnosis; your paid subscription is checked for each request.';
}
showSession();
if (failure) status.textContent = failure === 'membership_required'
  ? 'We could not match an active paid subscription to this PayPal account. Check the subscription ID and use the account that paid. Do not subscribe again.'
  : 'Sign-in could not be completed. Please try again later. You do not need to subscribe again.';
if (storageFailed) status.textContent = 'This browser is blocking session storage. Allow storage for this website to stay signed in.';
logout.addEventListener('click', () => {
  clearMemberToken(); logout.hidden = true; status.textContent = 'Signed out of this website.';
});
let ready = false;
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!ready || !form.reportValidity()) return;
  location.assign(`${backend}/api/member/start?${new URLSearchParams({ subscription_id: input.value.trim().toUpperCase() })}`);
});
try {
  const response = await fetch(`${backend}/api/member/status`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('unavailable');
  ready = (await response.json()).ready === true;
  button.disabled = !ready;
  if (!ready) status.textContent = 'Member sign-in is being set up and is not available yet. Keep your PayPal receipt. You do not need to pay again. Current public tools remain available.';
  else if (!getMemberToken() && !failure && !storageFailed) status.textContent = 'Enter your subscription ID, then sign in securely on PayPal.';
} catch {
  status.textContent = 'Member sign-in is temporarily unavailable. Please try again later. Do not subscribe again.';
}
