import { getMemberToken, setMemberToken, clearMemberToken } from '../api/member-session.js';
const backend = 'https://a-to-z-wise-ai-backend.ad9259465.workers.dev';
const status = document.getElementById('memberStatus');
const form = document.getElementById('memberLoginForm');
const codeForm = document.getElementById('memberCodeForm');
const button = document.getElementById('memberLoginButton');
const logout = document.getElementById('memberLogout');
const input = document.getElementById('subscriptionId');
const subscription = new URLSearchParams(location.search).get('subscription_id');
if (location.hash || location.search) history.replaceState(null, '', location.pathname);
if (/^I-[A-Z0-9]{6,64}$/.test(subscription || '')) input.value = subscription;
let ready = false, challengeId = '', browserNonce = '';
function showSession() {
  logout.hidden = !getMemberToken();
  if (!logout.hidden) status.textContent = 'Signed in on this tab. Your subscription is checked when you request real AI diagnosis.';
}
showSession();
logout.addEventListener('click', () => {
  clearMemberToken(); logout.hidden = true; status.textContent = 'Signed out of this website.';
});
async function post(path, body) {
  const response = await fetch(`${backend}/api/member/email/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(35000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Sign-in is temporarily unavailable. Please try again.');
  return result;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!ready || button.disabled || !form.reportValidity()) return;
  button.disabled = true; codeForm.hidden = true;
  browserNonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  status.textContent = 'Requesting your sign-in code…';
  try {
    const result = await post('start', { email: document.getElementById('memberEmail').value.trim(), subscriptionId: input.value.trim().toUpperCase(), browserNonce });
    challengeId = result.challengeId; status.textContent = result.message; codeForm.hidden = false;
    document.getElementById('memberCode').value = ''; document.getElementById('memberCode').focus();
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = !ready; }
});
codeForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = codeForm.querySelector('button');
  if (submit.disabled || !codeForm.reportValidity()) return;
  submit.disabled = true;
  try {
    const result = await post('verify', { challengeId, browserNonce, code: document.getElementById('memberCode').value.trim().toLowerCase() });
    if (!result.memberToken || !setMemberToken(result.memberToken)) throw new Error('Allow browser session storage to stay signed in, then request another code.');
    codeForm.hidden = true; challengeId = ''; browserNonce = ''; document.getElementById('memberCode').value = ''; showSession();
  } catch (error) { status.textContent = error.message; }
  finally { submit.disabled = false; }
});
try {
  const response = await fetch(`${backend}/api/member/status`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error();
  const result = await response.json(); ready = result.ready === true && result.method === 'email'; button.disabled = !ready;
  if (!ready) status.textContent = 'Email sign-in is being set up. Keep your PayPal receipt; you do not need to pay again. Current public tools remain available.';
  else if (!getMemberToken()) status.textContent = 'Enter the email and subscription ID from your PayPal subscription. We will email you a sign-in code.';
} catch { status.textContent = 'Member sign-in is temporarily unavailable. Please try again later. Do not subscribe again.'; }
