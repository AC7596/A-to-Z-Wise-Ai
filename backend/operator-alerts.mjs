export async function sendOperatorAlert(env, subject, text) {
  const to = env.ALERT_DESTINATION;
  if (!to || !env.OPERATOR_ALERTS) throw new Error('Alert destination unavailable');
  const { EmailMessage } = await import('cloudflare:email');
  const from = 'support@atozwiseai.com';
  const raw = [
    'From: A to Z Wise AI Support <' + from + '>',
    'To: ' + to,
    'Subject: A to Z alert: ' + subject,
    'Date: ' + new Date().toUTCString(),
    'Message-ID: <' + crypto.randomUUID() + '@atozwiseai.com>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '', text
  ].join('\r\n');
  await env.OPERATOR_ALERTS.send(new EmailMessage(from, to, raw));
}
