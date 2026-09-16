# A to Z Wise AI — regression tests

Lightweight, dependency-free regression tests for A to Z Wise AI's front-end
logic modules. These run directly under plain Node.js (no `npm install`,
no test framework, no build step) — consistent with this project's
GitHub-Pages-only, no-build-step constraint.

## Running

From the repository root:

```bash
node tests/regression-malfunction-signal.mjs
node tests/regression-co-vs-co2.mjs
node tests/regression-co-vs-co2-followup.mjs
node tests/regression-kids-progress.mjs
node tests/regression-diagnosis-followup.mjs
node tests/regression-diagnosis-facts.mjs
node tests/regression-diagnosis-backend.mjs
node tests/regression-branding.mjs
node tests/regression-monetization.mjs
node tests/regression-my-home.mjs
node tests/regression-secure-backend-service.mjs
node tests/regression-cloudflare-worker-config.mjs
```

Each script exits with a non-zero status (via Node's built-in
`assert/strict`) if any check fails, so they can be wired into CI later
without any additional tooling.

## What each file covers

- **regression-malfunction-signal.mjs** — `hasMalfunctionSignal()` in
  `js/api/ai-client.js` uses whole-word/phrase matching (shared with
  `js/data/safety-data.js`) instead of plain substrings, so words like
  "spark" don't false-match inside "sparkling", "trip" inside "triple",
  "dead" inside "deadline", or "crack" inside "crackers". Also confirms the
  core PR fix: "I want to replace my outlets." is treated as an intentional
  replacement (asks a clarifying question) rather than an outlet
  malfunction.
- **regression-co-vs-co2.mjs** — the safety/risk classifier in
  `js/data/safety-data.js` treats carbon monoxide (CO) and carbon dioxide
  (CO2) as separate signals at different severities, so "CO2 alarm" can
  never trigger the carbon-monoxide STOP/emergency response just because
  "CO" is a substring of "CO2" — while genuine CO alarm language still
  reliably triggers it, including when CO2 is mentioned in the same
  sentence.
- **regression-co-vs-co2-followup.mjs** — the full follow-up/refine
  diagnosis conversation flow (`diagnoseProblem()` in `js/api/ai-client.js`
  across an initial message + a follow-up answer): once a follow-up answer
  confirms carbon monoxide, the carbon-dioxide signal is dropped entirely
  (via `excludes` in `js/data/safety-data.js`) so a confirmed CO emergency
  response never contains contradictory CO2 "different hazard, not
  immediately life-threatening" language, and vice versa for a confirmed
  CO2 answer. Also covers immediate (no-follow-up-needed) CO recognition and
  the still-ambiguous case correctly continuing to ask instead of guessing.
- **regression-kids-progress.mjs** — `awardActivity()` in
  `js/modules/kids-progress.js` only awards XP and counts an activity
  toward set-completion/badges on its *first* completion; replaying an
  already-completed activity (the "Do it again" flow) is a safe no-op for
  XP, uniqueness, and badge thresholds, and progress correctly persists to
  (and reloads from) `localStorage`.
- **regression-diagnosis-facts.mjs** — the session-fact reasoning layer
  (`js/data/fact-data.js` wired into `diagnoseProblem()` in
  `js/api/ai-client.js`): "My dryer runs but doesn't get hot." is read as
  runs+no-heat, so A to Z Wise AI never re-asks whether it runs and never leads
  with causes (drive belt, door switch) whose normal symptom would be a
  dryer that can't run; "My dryer won't start." takes the no-start
  sub-issue instead; a follow-up like "It's electric." preserves all
  earlier facts and narrows to electric-dryer no-heat causes; and a later
  contradictory answer ("The drum doesn't turn.") triggers a clarifying
  question instead of silently overwriting what was known. Also covers
  cross-category fact extraction (leak timing, outlet power + overheating,
  HVAC runs/no-heat), the condition DSL, and confirms the CO/CO2 safety
  behavior is untouched.
- **regression-diagnosis-followup.mjs** — end-to-end checks against
  `diagnoseProblem()` in `js/api/ai-client.js` (intent + risk + knowledge
  base together): an unrecognized-but-real signal like "My CO2 alarm is
  going off" now returns a clarifying follow-up (never the old "No
  specific match yet" dead end) without ever being treated as the CO
  emergency; genuine CO/carbon-monoxide language still triggers full STOP
  guidance; "replace my outlets" still asks rather than assumes a failure;
  the dryer/sink examples from the product brief get real diagnosis
  follow-ups; a matched issue with a related interactive guide (e.g.
  dripping faucet) surfaces `relatedGuideId` for the "Guide me through it"
  hand-off; and genuinely unrecognizable input still gets an honest,
  Zee-style follow-up instead of a dead end.
- **regression-diagnosis-backend.mjs** — the backend-ready diagnosis
  foundation: request shaping in `js/api/diagnosis-contract.js`, secure
  home-only payload fields, My Home equipment/maintenance context inclusion,
  structured cause normalization, successful live backend calls, and honest
  fallback back to Demo Mode when a configured backend is unavailable.
- **regression-branding.mjs** — launch-branding and SEO regression coverage
  for A to Z Wise AI: canonical/Open Graph URLs, robots directives, footer
  slogan, Zee/DIY Together wording, and the unchanged hosted PayPal
  subscription URL.
- **regression-monetization.mjs** — PayPal checkout and monetization checks:
  the hosted subscription URL, required public pages, pricing copy, robots
  sitemap reference, and absence of payment secrets in the core monetization
  files.
- **regression-my-home.mjs** — the first browser-only `My Home` digital
  profile foundation: default profile state includes starter maintenance
  reminders; home info, equipment, maintenance history, and reminder updates
  persist through storage-backed operations in `js/modules/my-home-store.js`;
  and the homepage/public-page navigation exposes the `My Home` experience
  without implying accounts or cloud backup.
- **regression-secure-backend-service.mjs** — secure backend foundation checks:
  validates `home-diy-only` request scope, verifies My Home context handling,
  confirms immediate STOP safety responses, verifies provider-response
  normalization into the existing UI contract, and checks missing backend
  credentials return a safe configuration error.
- **regression-cloudflare-worker-config.mjs** — deployment-config checks:
  verifies repository-root `wrangler.toml` points Cloudflare at
  `backend/worker.mjs` and does not declare static-assets-only config, so
  runtime secrets remain available.
