export function sendOperatorAlert(env, subject, text) {
  return env.OPERATOR_ALERTS.send({
    from: 'support@atozwiseai.com',
    to: null,
    subject: 'A to Z alert: ' + subject,
    text
  });
}
