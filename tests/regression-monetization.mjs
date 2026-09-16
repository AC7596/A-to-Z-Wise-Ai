import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getCheckoutUrl, HOSTED_CHECKOUT_URL } from '../js/checkout-config.js';

test('Monetization Configuration & Integration Checks', async (t) => {
  await t.test('configured checkout URL returns PayPal subscription URL', () => {
    const expectedUrl = 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-3UR170892E856923CNKQ2DVI';
    assert.equal(HOSTED_CHECKOUT_URL, expectedUrl);
    assert.equal(getCheckoutUrl(), expectedUrl);
  });

  await t.test('required HTML pages exist and contain correct content', () => {
    const pages = ['index.html', 'terms.html', 'privacy.html', 'safety.html', 'contact.html', 'success.html'];
    for (const page of pages) {
      const fullPath = path.resolve(process.cwd(), page);
      assert.ok(fs.existsSync(fullPath), `${page} should exist`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(content.includes('A to Z Wise AI'), `${page} should reference A to Z Wise AI`);
      assert.ok(content.includes('styles.css'), `${page} should include styles.css`);
    }
  });

  await t.test('success page keeps paypal messaging but links back through local site paths', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'success.html'), 'utf8');
    assert.ok(content.includes('started through PayPal'));
    assert.ok(content.includes('href="index.html" class="btn primary"'));
    assert.ok(content.includes('href="index.html#diagnosis" class="btn secondary"'));
  });

  await t.test('robots.txt advertises the atozwiseai.com sitemap', () => {
    const robotsPath = path.resolve(process.cwd(), 'robots.txt');
    const robots = fs.readFileSync(robotsPath, 'utf8');
    assert.ok(robots.includes('User-agent: *'));
    assert.ok(robots.includes('Sitemap: https://atozwiseai.com/sitemap.xml'));
  });

  await t.test('index.html contains pricing section and founding member offer', () => {
    const indexPath = path.resolve(process.cwd(), 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    assert.ok(indexContent.includes('id="pricing"'), 'index.html should have pricing section');
    assert.ok(indexContent.includes('$9.99'), 'index.html should state $9.99 pricing');
    assert.ok(indexContent.includes('A TO Z WISE AI FOUNDING MEMBER'), 'index.html should feature Founding Member offer');
    assert.ok(indexContent.includes('Become a Founding Member'), 'index.html should contain primary CTA');
    assert.ok(indexContent.includes('Become a Founding Member'), 'index.html hero should contain monetization CTA');
    assert.ok(indexContent.includes('AVAILABLE NOW'), 'index.html should label available features');
    assert.ok(indexContent.includes('IN DEVELOPMENT'), 'index.html should label in-development features');
  });

  await t.test('no hardcoded payment secret keys exist in codebase', () => {
    const files = ['js/checkout-config.js', 'js/modules/monetization.js', 'index.html', 'styles.css'];
    for (const f of files) {
      const content = fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
      assert.equal(content.includes('sk_live_'), false, `${f} must not contain live Stripe secret keys`);
      assert.equal(content.includes('sk_test_'), false, `${f} must not contain test Stripe secret keys`);
      assert.equal(content.includes('client_secret'), false, `${f} must not contain client secrets`);
      assert.equal(content.includes('PRIVATE_KEY'), false, `${f} must not contain private keys`);
    }
  });
});
