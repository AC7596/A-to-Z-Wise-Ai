# Managed accounts and paid AI rollout

Current production: public tools remain available. Paid-only enforcement is OFF.
The staged replacement uses Supabase Auth email OTP, PayPal subscriptions, and
Supabase Postgres with row-level security for private My Home cloud copies.
The abandoned custom email-code implementation is removed; do not configure D1
or the earlier RESEND_API_KEY Worker integration.

## Configure the user's Supabase project

1. Connect the Supabase plugin or sign in to the intended project. Creating a paid
   plan is not authorized. Confirm project and region with the owner if needed.
2. Apply backend/supabase/001_accounts.sql once. Verify RLS with two real test
   accounts: A cannot read/write/delete B's home or claim B's subscription.
3. Enable email OTP. Set the Magic Link email template to show {{ .Token }}.
   Set code expiry to 10 minutes; configure rate limits and CAPTCHA/bot protection
   suitable for a public site. Disable anonymous sign-in.
4. Set site URL https://atozwiseai.com and allow only intended redirect URLs.
5. Set up custom SMTP with a verified sending domain. Supabase's default mail
   service is for restricted testing, not customer launch. Verify delivery in a
   real inbox and spam folder. Do not send customer mail before setup approval.
6. Worker secrets: SUPABASE_SERVICE_ROLE_KEY (server only), PAYPAL_CLIENT_ID,
   PAYPAL_CLIENT_SECRET. Worker variables: SUPABASE_URL, SUPABASE_PUBLIC_KEY,
   MEMBER_LOGIN_METHOD=supabase, MANAGED_ACCOUNTS_ENABLED=true,
   PAYPAL_ENVIRONMENT=live, PAYPAL_PLAN_ID=P-3UR170892E856923CNKQ2DVI,
   ALLOWED_ORIGINS=https://atozwiseai.com,https://www.atozwiseai.com.
   Keep MEMBERSHIP_ENFORCED=false until real member and nonmember tests pass.
   Persist dashboard configuration through future Wrangler builds.

## Flows and release tests

- Public /api/member/config exposes only project URL and public key once ready.
- Supabase verifies email OTP and manages refreshable account sessions using its
  pinned browser SDK. Backend calls /auth/v1/user for authoritative identity.
- One-time subscription linking requires verified account email matching PayPal's
  subscription email, an active paid matching plan, and unique ownership. Link
  attempts are limited to 10 per account per hour. Support must review email
  mismatches; never ask customers to buy again to solve identity problems.
- Subsequent logins use the stored link. Every paid diagnosis rechecks PayPal.
  No webhooks are needed for this per-request policy. Cancellation and failed
  renewals deny paid diagnosis; free emergency guidance still works.
- Existing hosted checkout remains unchanged. Customers link after payment.
  Checkout redirects are never accepted as proof of identity or payment.
- My Home cloud copy is manual save/load/download, NOT automatic synchronization.
  Existing browser records are never uploaded automatically. Loads first download
  a local backup. Compare-and-swap revision checks protect against stale saves.
- Test sign-in, refresh, sign-out, two tabs/accounts, wrong/expired codes, existing
  buyer link without another charge, canceled/nonmember denial, free emergency
  advice, cloud isolation, revision conflict, backup download and storage failure.
- Verify CDN SDK loading and phone layout. Deployment has not been approved as
  complete until real Supabase, SMTP, SQL and PayPal checks pass.
- Update homepage claims only at activation. Privacy copy is staged and must name
  the selected mail provider before release. Establish account/data-deletion support.

Tests use mocked network responses and cover backend logic, not live provider
configuration or SQL RLS execution. Never describe those as live end-to-end tests.

Official references:
https://supabase.com/docs/guides/auth/auth-email-passwordless
https://supabase.com/docs/guides/auth/auth-smtp
https://supabase.com/docs/guides/database/postgres/row-level-security
https://supabase.com/docs/reference/javascript/auth-getuser
