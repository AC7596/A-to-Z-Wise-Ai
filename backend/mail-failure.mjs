const events = new Set(['email.bounced', 'email.failed', 'email.suppressed', 'email.delivery_delayed']);
const encoder = new TextEncoder();
const decode = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

export async function recordMailFailure(request, env) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const secret = env.RESEND_WEBHOOK_SECRET;
  const id = request.headers.get('svix-id');
  const time = request.headers.get('svix-timestamp');
  const signatures = request.headers.get('svix-signature') || '';
  if (!secret?.startsWith('whsec_') || !id || !/^\d+$/.test(time) ||
      Math.abs(Date.now() / 1000 - Number(time)) > 300) return new Response(null, { status: 401 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, {status: 400});
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 131072) { await reader.cancel(); return new Response(null, {status: 413}); }
    body += decoder.decode(value, {stream:true});
  }
  body += decoder.decode();
  const key = await crypto.subtle.importKey('raw', decode(secret.slice(6)), {name:'HMAC', hash:'SHA-256'}, false, ['verify']);
  const data = encoder.encode([id,time,body].join('.'));
  let valid = false;
  for (const signature of signatures.split(' ')) {
    if (!signature.startsWith('v1,')) continue;
    try { valid = await crypto.subtle.verify('HMAC',key,decode(signature.slice(3)),data); }
    catch { continue; }
    if (valid) break;
  }
  if (!valid) return new Response(null, {status:401});
  let event;
  try { event = JSON.parse(body); } catch { return new Response(null, {status:400}); }
  if (events.has(event?.type) && /^(?:[^<>]*<)?login@mail\.atozwiseai\.com>?$/i.test(event.data?.from || '')) {
    console.error('Member sign-in email delivery issue: ' + event.type);
  }
  return new Response(null, {status:204});
}
