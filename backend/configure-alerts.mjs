import { readFileSync, writeFileSync } from 'node:fs';

const recipient = process.argv[2];
if (!/^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(recipient || '')) {
  throw new Error('Provide one verified destination address for operator alerts.');
}
// Cloudflare supplies the destination in its private build configuration.
const config = new URL('../wrangler.toml', import.meta.url);
const binding = '\n[[send_email]]\nname = "OPERATOR_ALERTS"\ndestination_address = ' + JSON.stringify(recipient) + '\n';
const existing = readFileSync(config, 'utf8');
if (!existing.includes(binding)) {
  const vars = '[vars]\nALERT_DESTINATION = ' + JSON.stringify(recipient);
  writeFileSync(config, existing.replace('[vars]', vars) + binding);
}
