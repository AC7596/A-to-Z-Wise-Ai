# Connecting a Secure AI Backend to A to Z Wise AI

A to Z Wise AI's front end is currently hosted on **GitHub Pages**, which only
serves static files (HTML, CSS, JavaScript, images). Static hosting **cannot
securely hold API keys or secrets** — anything placed in browser-side code
is publicly visible to anyone who views the page source. This document
explains what is needed to connect a real AI diagnosis and photo-analysis
service without exposing credentials.

## Why this matters

If an AI provider API key were placed directly in `js/api/ai-client.js` (or
any other HTML/CSS/JS file), anyone visiting the site could copy it and use
it — potentially running up usage costs or abusing the account. This is why
A to Z Wise AI's diagnosis logic currently runs entirely client-side as a demo,
with no network calls and no keys anywhere in the repository.

## What a production backend needs

1. **A backend service that is not GitHub Pages.** Options include:
   - A serverless function (Azure Functions, AWS Lambda, Cloudflare
     Workers, Vercel/Netlify functions).
   - A small dedicated API server (Node.js/Express, Python/FastAPI, etc.)
     hosted somewhere that supports server-side secrets.
2. **Secret storage on the backend**, such as environment variables or a
   secrets manager, holding the AI provider's API key. The key is never
   sent to or stored in the browser.
3. **An HTTPS API endpoint** the front end can call, for example:
   - `POST /api/diagnose` — accepts category, problem description, and
     symptom fields (what the user sees/hears/smells) and optionally photo
     files; returns a diagnosis object.
   - `POST /api/analyze-photos` — accepts one or more images and returns
     image-analysis results (once real image analysis is available).
4. **Input validation and rate limiting** on the backend to prevent abuse
   and control cost (e.g. limit request size, photo count/size, and
   requests per user/IP).
5. **CORS configuration** on the backend to allow requests from the
   GitHub Pages origin (e.g. `https://<user>.github.io`).
6. **(Optional, for future features) A database and authentication
   provider** for user accounts, saved repair projects, repair history,
   and parent/child linked Zee activities. This is not required to launch
   basic AI diagnosis, but is needed for the "Product Foundation" roadmap
   items described in the README.

## Request shape the front end sends

```jsonc
{
 "version": "2026-09-home-diy-v1",
 "scope": "home-diy-only",
 "category": "string (Plumbing | Electrical | Heating & Cooling | Appliance | Structural | Home Equipment | Doors & Windows | Other)",
 "areaOrEquipment": "string",
 "equipment": {
   "make": "string",
   "model": "string"
 },
 "problem": "string",
 "symptoms": {
   "seen": "string",
   "heard": "string",
   "smell": "string",
   "leakDetails": "string",
   "errorCode": "string",
   "intermittentBehavior": "string",
   "problemStart": "string",
   "otherSymptoms": "string"
 },
 "conversationHistory": [
   { "answer": "string", "timestamp": "ISO 8601 string" }
 ],
 "useMyHomeContext": true,
 "myHomeContext": {
   "selectedEquipment": {
     "type": "string",
     "manufacturer": "string",
     "modelNumber": "string",
     "serialNumber": "string",
     "installationDateOrAge": "string",
     "warrantyExpiration": "string",
     "notes": "string"
   },
   "maintenanceHistory": [{ "servicePerformed": "string", "date": "string", "partsUsed": "string", "notes": "string" }],
   "previousRepairs": [{ "servicePerformed": "string", "date": "string", "partsUsed": "string", "notes": "string" }]
 },
 "requestedOutputs": {
   "possibleCauses": true,
   "causeExplanations": true,
   "safeChecks": true,
   "tools": true,
   "parts": true,
   "nextActions": true,
   "safetyWarnings": true,
   "whenToStopDIY": true,
   "whenToCallProfessional": true,
   "followUpQuestions": true
 },
 "disclaimers": {
   "scope": "home-diy-only",
   "requireVerifiedManufacturerClaims": true,
   "neverClaimCertainty": true
 },
 "attachmentSummary": {
   "photoCount": 2
 }
}
```

The browser sends this JSON inside a multipart `FormData` field named
`request`, and appends each actual photo file separately under the `photos`
field. The backend should therefore read structured request data from the
JSON field and uploaded image binaries from the multipart files.

`conversationHistory` carries every follow-up answer the homeowner has
given so far in the current browser session (see "Follow-up conversation"
in the README), so the backend can progressively narrow the diagnosis
instead of treating each request as unrelated to the last.

`scope: "home-diy-only"` is intentional. Do not use this endpoint for
automotive diagnosis yet.

## Response shape the front end expects

To avoid reworking the UI when a real backend is connected, keep the same
shape currently used by the demo logic in `js/api/ai-client.js`:

```jsonc
{
  "matched": true,
  "needsFollowUp": false,
  "confidence": {
    "level": "high | medium | low",
    "label": "string, e.g. \"Likely cause, based on the details you provided\""
  },
  "hasDanger": false,
  "dangerConfig": { "message": "string", "badge": "string" },
  "possibleCauses": [
    { "title": "string", "whyPossible": "string" }
  ],
  "otherPossibleCauses": [
    { "title": "string", "whyPossible": "string" }
  ],
  "safeChecks": ["string", "..."],
  "nextActions": ["string", "..."],
  "safetyWarnings": ["string", "..."],
  "whenToStopDIY": ["string", "..."],
  "whenToCallProfessional": ["string", "..."],
  "followUpQuestions": ["string", "..."],
  "issue": {
    "causes": ["string", "..."],
    "otherCauses": ["string", "..."],
    "clarifyingQuestions": ["string", "..."],
    "nextCheck": "string",
    "steps": ["string", "..."],
    "tools": ["string", "..."],
    "parts": ["string", "..."],
    "time": "string",
    "difficulty": "easy-check | beginner | intermediate | advanced | professional | emergency",
    "tips": ["string", "..."],
    "stopWhen": "string",
    "safety": "string",
    "pro": "string"
  },
  "category": "string"
}
```

`confidence` is optional (omit or set to `null` when there isn't enough
signal for even a rough estimate) and must always be phrased as a
likelihood ("possible cause", "likely cause") — never as a certainty.

Additional optional fields the demo engine already produces (a real
backend may do the same; the UI ignores them when absent):

- `knownFacts`: an object of session facts extracted from the homeowner's
  own words so far, e.g. `{ "runs": true, "heats": false,
  "powerType": "electric" }` — the backend should reason from these rather
  than re-asking already-answered questions.
- `subject`: the specific item/system detected (e.g. `"dryer"`).
- `hasContradiction`: `true` when the latest follow-up answer conflicts
  with an earlier established fact; in that case the response should be a
  `needsFollowUp: true` clarification question rather than a silent
  re-diagnosis.

## Steps to connect the real backend

1. Build and deploy the backend endpoint(s) described above.
2. Set the backend's HTTPS URL non-secretly — either the
   `fixwise-backend-url` `<meta>` tag in `index.html`, or a
   `window.FIXWISE_CONFIG.backendUrl` global (see `resolveBackendBaseUrl()`
   in `js/api/ai-client.js`). No secrets are involved in this step; the URL
   itself is not sensitive.
3. Replace the body of `diagnoseProblem()` and `analyzePhotos()` with
   `fetch()` calls to the backend (example code is already sketched in
   comments in that file).
4. Remove or keep `localDemoDiagnosis()` as an offline fallback — your
   choice, but make sure the UI never claims a real AI analyzed something
   when it did not.
5. Test thoroughly, especially error states (network failure, backend
   downtime, invalid responses) since `js/api/ai-client.js` now supports an
   honest demo fallback and `js/modules/diagnosis.js` already has loading/
   error handling wired up to support this.

## What is intentionally NOT built yet

- No AI provider integration code (this requires choosing a provider and
  backend platform, which is a product/infrastructure decision).
- No authentication/user accounts backend.
- No database for saved projects, repair history, or Zee progress.
- No real image analysis — this requires an image-capable AI model and
  the same secure-backend pattern described above.

These are deliberately left as documented next steps rather than partial,
insecure implementations.
