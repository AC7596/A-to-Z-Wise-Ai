# Paid AI diagnosis rollout

Implemented but NOT activated: PayPal OAuth sign-in, signed one-hour member
sessions, browser-bound ten-minute login state, per-request PayPal subscription
verification, and the member access page. No webhook is required for this version:
each provider request checks current subscription details directly.

## Deployment configuration

Keep `MEMBERSHIP_ENFORCED` and `PAYPAL_LOGIN_APPROVED` unset until the live buyer
flow is verified. Missing setup never grants member status. Enabling enforcement
without completed setup blocks real AI calls (free emergency guidance remains).

Set Worker secrets outside git:
- PAYPAL_CLIENT_ID
- PAYPAL_CLIENT_SECRET
- MEMBER_SESSION_SECRET (at least 32 cryptographically random bytes)

Set Worker variables:
- PAYPAL_ENVIRONMENT: live (sandbox for tests)
- PAYPAL_PLAN_ID: P-3UR170892E856923CNKQ2DVI
- MEMBER_CALLBACK_URL: https://a-to-z-wise-ai-backend.ad9259465.workers.dev/api/member/callback
- MEMBER_SITE_URL: https://atozwiseai.com/member.html
- PAYPAL_LOGIN_APPROVED: true only after PayPal approves the login integration
- MEMBERSHIP_ENFORCED: true only after successful live-member and nonmember tests

Request only the PayPal payer ID identity attribute. Consent URLs use the site's
privacy.html and terms.html. PayPal must review live login access. Configure the
callback above as a permitted return URL. Do not expose secrets in browser code.

## Required release gates

1. Verify the new app's API credentials can read the EXISTING subscription and
   plan. Existing subscriptions may remain bound to an older app; retain all
   old apps and credentials until this is proven. Do not migrate or cancel buyers.
2. Confirm PayPal has approved identity login and returns payer_id with the
   configured scope. Verify a sandbox authorization roundtrip first.
3. Test a real paid buyer's sign-in with their participation, without charging
   again. Confirm the correct payer and subscription match and a diagnosis works.
4. Test unsigned, expired, wrong-payer, unpaid, canceled and suspended access.
5. Enable enforcement and check both member success and nonmember denial on the
   deployed Worker, then update pending-setup public copy.

Current policy requires ACTIVE status, matching plan and payer, a positive USD
payment, a future next billing time, and no failed payments. It grants no overdue
grace period and does not support guest/card-only buyers without a PayPal payer
ID yet. Handle such customers before activation. Local logout clears the browser
token; already-copied tokens expire within one hour. Production capacity/rate
limits and recovery flows should be reviewed before a wider launch.

Do not describe the paywall as live until all release gates pass. The public
success page is not proof of payment and checkout query parameters are not login.

## Email sign-in replacement (staged, not activated)

Set MEMBER_LOGIN_METHOD=email to replace PayPal identity OAuth with emailed proof.
PayPal remains the billing source; no subscription is created or changed by login.
Customers enter their subscription ID and the email on that PayPal subscription.
A 128-bit single-use code is emailed only after the server matches that address to
an active, paid subscription. Redeeming requires the requesting browser's random
nonce and rechecks payment. The resulting one-hour session uses the same
per-diagnosis paid-subscription check. PayPal login approval is not needed for
this method, but API access to existing subscriptions must still be verified.

Required before activation:
- Create a Cloudflare D1 database, apply migrations/0001_member_email.sql, and bind
  it as MEMBER_DB. Persist the binding in both deploy configurations.
- Configure a verified sending domain with an email service. The current adapter
  uses Resend (https://resend.com/docs/api-reference/emails/send-email).
- Set RESEND_API_KEY as an encrypted secret; set MEMBER_EMAIL_FROM to the verified
  sender. Disable provider click/open tracking for authentication email.
- Set EMAIL_LOGIN_ENABLED=true only after configuration and a real inbox delivery
  test. MEMBERSHIP_ENFORCED stays false until a real existing paid buyer succeeds
  and a nonmember is denied on the deployed endpoint.
- Update the privacy policy to identify the mail provider and short-lived member
  challenge storage BEFORE enabling delivery. Do not send customer emails yet.

The database stores only code/nonce hashes plus PayPal payer/subscription IDs for
10-minute challenges. Rate-limit identifiers are salted hashes of email/IP, with
hourly limits (5 sends per email, 40 requests per IP). Expired entries are cleaned
on subsequent requests; configure scheduled cleanup for a strict retention SLA.
No password is collected. Codes are entered on the requesting tab; refreshing the
page requires a new code. This initial version still asks for the subscription ID
on each new login; it is not a full cross-device home-record account system.
Do not infer a verified email or paid status from client-provided values alone.

Validation: tests/regression-email-member.mjs uses real in-memory SQLite queries,
mock provider responses and mock email delivery. This does not prove live delivery
or access to the merchant's existing subscription.
