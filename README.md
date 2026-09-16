# A to Z Wise AI

**Know what's wrong before you call a pro.**

A to Z Wise AI is a front-end product foundation for an AI-assisted home repair
platform. It helps homeowners describe a repair problem, get informational
guidance on likely causes and next steps, browse a library of repair guides,
and — through **DIY Together** and its mascot **Zee** — turn real repairs
into safe, age-appropriate learning moments for kids.

> "Fix it together. Learn it together." — DIY Together with Zee
> "I don't know yet — let's figure it out!" — Zee

This is a **static site** (HTML/CSS/JavaScript, ES modules, no build step)
designed to run on **GitHub Pages**.

---

## What A to Z Wise AI currently does

- **AI Home Diagnosis (frontend + backend-ready):** homeowners pick a category
  (Plumbing, Electrical, HVAC, Appliance, Structural, Home Equipment, Doors & Windows, or Other), name the area/system/equipment involved, describe what they see, hear,
  smell, and notice, optionally add leak details, error codes, intermittent behavior, when the problem started, make/model information, reuse a saved My Home equipment record, attach photos, and get a structured result:
  a confidence/likelihood label, most likely causes, other possible causes,
  why each cause is possible, safe checks, clarifying questions, step-by-step next actions, tools/parts needed,
  estimated time, DIY difficulty, safety warnings, stop conditions, and
  when to call a professional. Results are always phrased as "possible" or
  "likely" — never as a guaranteed fact.
- **Follow-up conversation:** after a diagnosis, homeowners can add more
  detail or answer a clarifying question without starting over. Each
  answer is added to the current diagnosis session and the diagnosis is
  re-run using the full conversation so far (see "Diagnosis architecture"
  below).
- **Session-fact reasoning:** the demo diagnosis engine extracts explicit
  facts from everything the homeowner has already said — the original
  description and every follow-up answer (e.g. "runs but doesn't heat"
  = appliance runs + no heat; "it's electric" = power type) — and uses
  them to pick the right troubleshooting path, to never re-ask an
  already-answered question, to demote causes that contradict known facts,
  and to ask for clarification when a later answer conflicts with an
  earlier one (see `js/data/fact-data.js`).
- **In-browser session state:** the current diagnosis (form fields, any
  follow-up answers, and the latest result) is saved to the browser's
  `sessionStorage` so it survives a page reload within the same tab. It
  never leaves the browser and is cleared on "Reset" or when the tab closes.
- **Photo upload:** click to select or drag-and-drop multiple photos,
  preview them, and remove any before submitting. Photos are attached to
  the request/demo response but are **not** analyzed by AI yet (see below).
- **Demo Mode indicator + backend fallback:** a badge next to the diagnosis result clearly
  shows whether the app is running in **Demo Mode** (no backend configured)
  or is connected to a real backend, so users are never misled about what
  produced a result.
- **Repair Guides library:** searchable/filterable guides across Plumbing,
  Electrical, Heating & Cooling, Doors & Windows, Appliances, Walls &
  Drywall, Flooring, Bathrooms, Kitchens, and Basic Home Maintenance. Each
  guide includes symptoms, causes, tools, parts, safety warnings, steps,
  time, difficulty, tips, stop conditions, and when to call a pro.
- **DIY Together with Zee:** a mascot-led concept explaining how a child can
  safely follow along with a real repair a parent is doing, with a roadmap
  of future learning activities.
- **Safety system:** a dedicated section calling out high-risk situations
  (electrical, gas/CO, fire, structural, hazardous materials, major leaks,
  sewage, mold, fall hazards) where users should stop and call a professional.
- **DIY vs. Professional level system:** a shared, color-coded scale (Easy
  homeowner check → Beginner DIY → Intermediate DIY → Advanced repair →
  Professional recommended → Emergency/stop immediately) used consistently
  across diagnosis results and repair guides.
- Responsive layout (phone/tablet/desktop), mobile navigation, loading/
  error/empty states, and client-side form validation.

## Diagnosis architecture (how it fits together)

```
User fills form + optional photos
        │
        ▼
js/modules/diagnosis.js  ── builds a request (category, area/equipment,
        │                    problem, symptom details, make/model,
        │                    optional My Home context, photos,
        │                    conversationHistory) and shows loading state
        ▼
js/api/ai-client.js       ── the ONLY place that knows whether a backend
        │                    is configured (isBackendConnected()).
        │
        ├─ Backend configured → sends the request to BACKEND_BASE_URL
        │                        (see "Demo Mode & backend configuration")
        │
        └─ No backend configured (Demo Mode) → localDemoDiagnosis() runs a
                                                 keyword-matching stand-in
                                                 against js/data/diagnosis-data.js
        ▼
Structured response (matched, needsFollowUp, confidence, hasDanger/
dangerConfig, issue, relatedGuideId, category) is rendered by
js/modules/diagnosis.js — this rendering code never changes based on
whether the response came from the demo engine or a real backend, because
both return the same shape.
```

Follow-up answers are appended to `conversationHistory` in the browser
session and re-sent with the next diagnosis request, so a real backend can
use the full conversation to progressively narrow its answer instead of
treating each message as unrelated.

The demo engine's `localDemoDiagnosis()` already models that narrowing
locally: `js/data/fact-data.js` extracts session facts from each message
separately (original form fields, then each follow-up answer in order),
and the result is used to (1) select the matching sub-issue of a
knowledge-base entry (e.g. dryer no-heat vs no-start), (2) filter out
clarifying questions whose answers are already known, (3) drop or demote
causes that contradict established facts, and (4) turn a contradictory
later answer into a clarifying question instead of silently picking one
reading. Knowledge-base entries declare this declaratively via `subIssues`
(`when`/`notWhen` fact conditions) and per-cause/per-question `when` /
`notWhen` conditions in `js/data/diagnosis-data.js`.

`localDemoDiagnosis()` is intentionally designed to never dead-end: when it
recognizes an intent (troubleshoot/repair/replace/install/...) or a safety
signal but doesn't have a specific knowledge-base match, it asks a
clarifying question (`needsFollowUp: true`) instead of a flat "no match"
response — and if it genuinely doesn't recognize anything at all, it says
so honestly and asks a general question, in keeping with Zee's "I don't
know yet — let's figure it out" philosophy. When a matched issue has a
corresponding entry in `js/data/guides-data.js`, `relatedGuideId` is set so
the UI can offer "Guide me through it" and hand off into the existing
interactive repair mode (`js/modules/repair-mode.js`).

## Demo Mode & backend configuration

A to Z Wise AI now includes a **secure backend foundation** in the
`backend/` folder, while the public GitHub Pages site still defaults to
**Demo Mode** until a deployed backend URL and server-side provider
credentials are configured.

The browser never receives an AI provider key. The frontend sends structured
diagnosis requests to the configured backend URL, and if the backend cannot
be reached it falls back honestly to Demo Mode with an explicit status
message so the site never breaks.

To connect a deployed backend without code changes or rebuilds, set its HTTPS
URL in **one** of these non-secret places:

- The `content` attribute of `<meta name="fixwise-backend-url" content="">`
  in `index.html`'s `<head>`, **or**
- A global `window.FIXWISE_CONFIG = { backendUrl: 'https://...' }` (e.g. via
  a small, un-committed config script for local overrides).

Once either is set, `isBackendConnected()` becomes `true`, the badge switches
to "Backend connected", and `diagnoseProblem()` will call the secure backend
endpoint (`/api/diagnose`).

**Why not just put an API key here instead?** GitHub Pages only serves
static files — anything in this repository or shipped to the browser is
publicly visible to anyone who views the page source. A backend *URL* is
not sensitive (it's just an address), but an AI provider *API key* is a
secret that must stay server-side. See [BACKEND.md](BACKEND.md) for the
full explanation and the request/response contract the backend should
implement.

## What is still demo/public-preview behavior

- The local diagnosis engine (`js/api/ai-client.js` → `localDemoDiagnosis`) is
  still a **keyword-matching stand-in** whenever backend configuration is
  missing or unreachable.
- Photo analysis is **not performed**. Photos are previewed, attached, and
  passed along in the request, but `analyzePhotos()` honestly reports that
  automatic image analysis is not yet connected — the site never pretends
  to have analyzed an image.
- DIY Together with Zee features beyond the current mascot/concept (levels, badges,
  parent-linked activities, animated Zee content, etc.) are shown as a
  "coming soon" roadmap, not working features.
- User accounts, saved projects, repair history, professional referrals,
  parts recommendations, and cost estimates are represented as roadmap
  cards only.

## What requires deployed backend configuration

See **[BACKEND.md](BACKEND.md)** and `backend/README.md` for full details. In
short: real AI diagnosis requires deploying the backend service and setting
provider credentials in the backend environment. **No API keys or secrets are
stored in this repository or any browser-side file.**

## Project structure

```
index.html              Page markup for all sections
styles.css               All styles (mobile-first, responsive)
js/
  main.js                Entry point — wires up all modules
  modules/
    nav.js                Mobile navigation menu
    photo-upload.js        Multi-photo select/preview/remove
    diagnosis.js            Diagnosis form + results rendering
    guides.js                Repair guide search/filter/render
    kids.js                   Zee interactivity
  data/
    levels.js               Shared DIY/professional level definitions
    diagnosis-data.js        Diagnosis knowledge base (demo logic)
    guides-data.js            Repair guide content (easy to extend)
  api/
    ai-client.js              Frontend client for secure diagnosis backend + demo fallback
backend/
  worker.mjs                  Server-side /api/diagnose endpoint
  diagnosis-service.mjs       Validation, safety guardrails, provider call, normalization
```

Adding a new repair guide is a matter of adding one object to the array in
`js/data/guides-data.js` — the search, filter, and rendering code picks it
up automatically.

## How to preview the website

1. Clone or download this repository.
2. Open `index.html` directly in a browser, **or** serve the folder with
   any static server (recommended, since ES modules work more reliably over
   `http://` than `file://`), for example:
   ```bash
   python3 -m http.server 8080
   ```
   then visit `http://localhost:8080`.

## GitHub Pages deployment

This site is published from the `main` branch and requires no build step —
GitHub Pages serves `index.html`, `styles.css`, and the `js/` folder as-is.
All scripts are loaded as ES modules (`<script type="module" src="js/main.js">`),
which GitHub Pages supports without any additional configuration.

## Activating live AI diagnosis (next step)

The repo is prepared for a Cloudflare Workers deployment while keeping this website on GitHub Pages.

1. Deploy `backend/worker.mjs` with `backend/wrangler.toml`.
2. Set backend secret/environment variables on Cloudflare:
   - `AI_PROVIDER_API_KEY` (required)
   - `AI_PROVIDER_MODEL` (optional)
   - `AI_PROVIDER_BASE_URL` (optional)
   - `ALLOWED_ORIGINS` (set to `https://atozwiseai.com,https://www.atozwiseai.com`)
3. Bind an HTTPS backend domain (recommended `https://api.atozwiseai.com`).
4. Set that URL in the `fixwise-backend-url` meta tag in `index.html` (or
   via `window.FIXWISE_CONFIG.backendUrl`). No rebuild is required.
5. Verify:
   - `/api/health` responds from the backend
   - diagnosis shows backend-connected mode when healthy
   - diagnosis safely falls back to Demo Mode when backend is unavailable/misconfigured

See `BACKEND.md` and `backend/README.md` for exact command-by-command deployment instructions and required external accounts/API keys.

## Brand note

The public product brand is "A to Z Wise AI" and the family helper mascot is
"Zee". Internal config keys and storage keys may still use legacy `fixwise`
identifiers where changing them would create unnecessary migration risk.
