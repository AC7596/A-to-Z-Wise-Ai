import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HOSTED_CHECKOUT_URL } from '../js/checkout-config.js';

const repoRoot = process.cwd();
const homepage = fs.readFileSync(path.resolve(repoRoot, 'index.html'), 'utf8');
const publicPages = ['index.html', 'terms.html', 'privacy.html', 'safety.html', 'contact.html', 'success.html'];
const customerFacingSources = [
  'js/modules/diagnosis.js',
  'js/modules/kids.js',
  'js/modules/kids-activities.js',
  'js/modules/kids-progress.js',
  'js/modules/repair-mode.js',
  'js/data/fixy-messages.js'
];
const expectedUrls = {
  'index.html': 'https://atozwiseai.com/',
  'terms.html': 'https://atozwiseai.com/terms.html',
  'privacy.html': 'https://atozwiseai.com/privacy.html',
  'safety.html': 'https://atozwiseai.com/safety.html',
  'contact.html': 'https://atozwiseai.com/contact.html',
  'success.html': 'https://atozwiseai.com/success.html'
};

test('Branding rebrand regression checks', async (t) => {
  const oldDomainPattern = /ac7596\.github\.io\/fixwise-ai/i;

  await t.test('homepage shows new brand, slogan, and family section copy', () => {
    assert.ok(homepage.includes('A to Z Wise AI'));
    assert.ok(homepage.includes('We\'ve Got DIY Covered.'));
    assert.ok(homepage.includes('DIY Together'));
    assert.ok(homepage.includes('ZEE'));
  });

  await t.test('public pages use the custom domain in canonical and Open Graph URLs', () => {
    for (const page of publicPages) {
      const content = fs.readFileSync(path.resolve(repoRoot, page), 'utf8');
      const expectedUrl = expectedUrls[page];
      assert.ok(content.includes(`<link rel="canonical" href="${expectedUrl}" />`), `${page} should set the canonical URL`);
      assert.ok(content.includes(`<meta property="og:url" content="${expectedUrl}" />`), `${page} should set the Open Graph URL`);
      assert.equal(oldDomainPattern.test(content), false, `${page} should not reference the GitHub Pages URL`);
    }
  });

  await t.test('public pages use launch robots directives', () => {
    for (const page of publicPages) {
      const content = fs.readFileSync(path.resolve(repoRoot, page), 'utf8');
      if (page === 'success.html') {
        assert.ok(content.includes('<meta name="robots" content="noindex,follow" />'), 'success.html should stay out of search results');
      } else {
        assert.ok(content.includes('<meta name="robots" content="index,follow" />'), `${page} should opt into indexing`);
      }
    }
  });

  await t.test('public pages standardize the footer slogan', () => {
    for (const page of publicPages) {
      const content = fs.readFileSync(path.resolve(repoRoot, page), 'utf8');
      assert.ok(
        content.includes('<p><a href="https://atozwiseai.com">atozwiseai.com</a> · We’ve Got DIY Covered.</p>'),
        `${page} should use the launch slogan in the footer`
      );
    }
  });

  await t.test('sub-page navigation links back to the roadmap section', () => {
    for (const page of publicPages.filter(page => page !== 'index.html')) {
      const content = fs.readFileSync(path.resolve(repoRoot, page), 'utf8');
      assert.ok(content.includes('href="index.html#roadmap"'), `${page} should link to the roadmap`);
    }
  });

  await t.test('old customer-facing FixWise branding is removed from public pages', () => {
    const disallowed = [
      '>FixWise AI<',
      '>FixWise Kids<',
      'Get FixWise Early Access',
      'Return to FixWise AI',
      'Back to FixWise AI',
      'Contact FixWise AI',
      'FIXWISE AI FOUNDING MEMBER',
      'Fixy says:',
      'Tap Fixy',
      'Fixy Helper'
    ];
    for (const source of publicPages) {
      const content = fs.readFileSync(path.resolve(repoRoot, source), 'utf8');
      for (const phrase of disallowed) {
        assert.equal(content.includes(phrase), false, `${source} should not contain ${phrase}`);
      }
    }
  });

  await t.test('customer-facing JS copy uses Zee and A to Z Wise AI wording', () => {
    const checks = [
      ['js/modules/kids.js', 'Tap Zee for an encouraging message', 'Tap Fixy for an encouraging message'],
      ['js/modules/kids-activities.js', '🔧 Zee says:', '🔧 Fixy says:'],
      ['js/modules/kids-progress.js', "label: 'Zee Helper'", "label: 'Fixy Helper'"],
      ['js/modules/repair-mode.js', 'See the DIY Together activity for this repair', 'See the FixWise Kids activity for this repair'],
      ['js/modules/diagnosis.js', 'What A to Z Wise AI understands:', 'What FixWise understands:']
    ];
    const disallowedPhrases = [
      'Tap Fixy for an encouraging message',
      '🔧 Fixy says:',
      "label: 'Fixy Helper'",
      'See the FixWise Kids activity for this repair',
      'Fixy: "',
      'What FixWise understands:',
      'FixWise doesn\'t have enough detail yet to give a specific, useful recommendation.',
      'here is FixWise\'s informational guidance'
    ];
    for (const [file, expected, disallowed] of checks) {
      const content = fs.readFileSync(path.resolve(repoRoot, file), 'utf8');
      assert.ok(content.includes(expected), `${file} should contain updated branding copy`);
      assert.equal(content.includes(disallowed), false, `${file} should not contain outdated branding copy`);
    }
    const repairModeContent = fs.readFileSync(path.resolve(repoRoot, 'js/modules/repair-mode.js'), 'utf8');
    assert.ok(repairModeContent.includes('🔧 Zee says:'), 'repair-mode.js should contain Zee helper copy');
    assert.equal(repairModeContent.includes('🔧 Fixy says:'), false, 'repair-mode.js should not contain Fixy helper copy');
    for (const file of customerFacingSources) {
      const content = fs.readFileSync(path.resolve(repoRoot, file), 'utf8');
      for (const phrase of disallowedPhrases) {
        assert.equal(content.includes(phrase), false, `${file} should not contain ${phrase}`);
      }
    }
  });

  await t.test('PayPal hosted subscription URL remains unchanged', () => {
    const expectedUrl = 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-3UR170892E856923CNKQ2DVI';
    assert.equal(HOSTED_CHECKOUT_URL, expectedUrl);
    assert.ok(homepage.includes(expectedUrl));
  });
});
