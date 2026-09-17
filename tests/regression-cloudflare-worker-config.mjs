import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wranglerToml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

test('root Cloudflare Worker config deploys backend runtime instead of static assets only', () => {
  assert.match(wranglerToml, /^name = "a-to-z-wise-ai-diagnosis-backend"$/m);
  assert.match(wranglerToml, /^main = "backend\/worker\.mjs"$/m);
  assert.doesNotMatch(wranglerToml, /^\[assets\]$/m);
  assert.match(wranglerToml, /^ALLOWED_ORIGINS = "https:\/\/atozwiseai\.com,https:\/\/www\.atozwiseai\.com"$/m);
  assert.match(wranglerToml, /wrangler secret put AI_PROVIDER_API_KEY/);
});
