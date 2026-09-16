# Secure AI backend deployment guide for A to Z Wise AI

A to Z Wise AI includes a server-side backend foundation for AI diagnosis in:

- `backend/worker.mjs`
- `backend/diagnosis-service.mjs`

GitHub Pages stays static and public at `atozwiseai.com`. No AI provider secret belongs in frontend code or git.

## Backend status in this repository

- `POST /api/diagnose` endpoint for diagnosis requests.
- Accepts the existing frontend contract (`multipart/form-data` with `request` JSON and optional `photos`).
- Enforces `scope: "home-diy-only"` and rejects unsupported categories.
- Uses server-side environment variables for AI provider credentials.
- Applies safety-first hazard detection and returns immediate STOP/CALL guidance for high-risk inputs.
- Returns structured diagnosis output compatible with the existing UI rendering.
- Keeps the existing frontend demo fallback behavior if backend is unavailable.
- Preserves and forwards My Home equipment/manufacturer/model/maintenance/repair context when provided.

## Backend files

- `backend/worker.mjs` — HTTP routing, CORS, payload parsing, response handling.
- `backend/diagnosis-service.mjs` — request validation, guardrails, provider call, response normalization.
- `backend/wrangler.example.toml` — example Cloudflare Worker config (no secrets).
- `backend/README.md` — deployment and configuration quick-start.

## Production hosting approach used here

This repo is now prepared for **Cloudflare Workers** as the simplest production backend while keeping the website on GitHub Pages.

- Static website remains on GitHub Pages (`atozwiseai.com`).
- Backend runs as a Worker on a separate HTTPS origin (recommended: `https://api.atozwiseai.com`).
- Frontend calls only that backend URL; provider keys stay server-side.

Prepared deployment files:

- `backend/wrangler.toml` (deployment config, no secrets)
- `backend/.gitignore` (prevents local secret files from being committed)
- `backend/wrangler.example.toml` (alternate template)

## Required backend environment variables

Set these on your backend platform (not in git):

- `AI_PROVIDER_API_KEY` (**required secret**)
- `AI_PROVIDER_MODEL` (optional, default `gpt-4o-mini`)
- `AI_PROVIDER_BASE_URL` (optional, default `https://api.openai.com/v1`)
- `ALLOWED_ORIGINS` (required for browser access in production; comma-separated allowlist)

OpenAI-compatible aliases are also supported:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`

## Frontend-to-backend connection (public, non-secret)

Frontend code already posts to `${backendUrl}/api/diagnose` in `js/api/ai-client.js`.

Set backend URL in one non-secret place:

- `<meta name="atozwiseai-backend-url" content="https://your-backend-domain">` in `index.html`, or
- `window.ATOZWISEAI_CONFIG.backendUrl` at runtime.

Legacy `fixwise-backend-url` and `window.FIXWISE_CONFIG.backendUrl` are still supported for compatibility.

If backend is not reachable or is not configured correctly, frontend automatically falls back to Demo Mode and clearly reports fallback status.

## External setup you must complete (outside GitHub)

1. Create/sign in to a Cloudflare account.
2. Add the `atozwiseai.com` domain to Cloudflare DNS (or manage DNS records there).
3. Create/get an AI provider API key (for example, OpenAI key for `gpt-4o-mini`, or another OpenAI-compatible provider).
4. Install Wrangler locally (`npm i -g wrangler`) and log in (`wrangler login`).
5. Deploy the Worker from the `backend/` folder and set secrets.

## Exact deployment steps (beginner-friendly)

From the repository root:

1. `cd backend`
2. Confirm `wrangler.toml` values:
   - `name = "a-to-z-wise-ai-diagnosis-backend"`
   - Production default: `ALLOWED_ORIGINS = "https://atozwiseai.com,https://www.atozwiseai.com"`
   - Optional testing-only temporary value: add `,https://ac7596.github.io` while testing from GitHub Pages, then remove it for full production lock-down
3. Set secret key (never in git):
   - `wrangler secret put AI_PROVIDER_API_KEY`
4. (Optional) set alternate non-secret vars in `wrangler.toml`:
   - `AI_PROVIDER_MODEL`
   - `AI_PROVIDER_BASE_URL`
5. Deploy:
   - `wrangler deploy`
6. In Cloudflare, map a custom domain route (recommended):
   - `api.atozwiseai.com/*` → this Worker
7. Health check:
   - `GET https://api.atozwiseai.com/api/health` → should return `{ "ok": true, ... }`
8. Update frontend backend URL:
   - Edit `/index.html`
   - Set `<meta name="atozwiseai-backend-url" content="https://api.atozwiseai.com">`
9. Commit and publish the frontend change to GitHub Pages.
10. Verify in browser:
   - Diagnosis result shows backend-connected mode.
   - If backend is down/misconfigured, UI safely falls back to Demo Mode with a clear message.

## What you personally need to do next (simple checklist)

1. In Cloudflare, open your Worker settings and run `wrangler secret put AI_PROVIDER_API_KEY` so the API key stays server-side.
2. Deploy from `backend/` with `wrangler deploy`.
3. In Cloudflare routes/domains, connect `api.atozwiseai.com/*` to this Worker.
4. Open `https://api.atozwiseai.com/api/health` and confirm you see `"ok": true`.
5. In `/index.html`, set `<meta name="atozwiseai-backend-url" content="https://api.atozwiseai.com">`.
6. Commit that frontend meta-tag change and publish GitHub Pages.
7. Test one diagnosis on the live site:
   - Success path: mode shows backend connected.
   - Safety path: if backend is unavailable, it clearly falls back to Demo Mode.

## Security and safety requirements kept in place

- Home/DIY scope only (`home-diy-only`); no automotive diagnosis.
- High-risk electrical, gas, fire, structural, chemical, sewage, and similar hazards return STOP/CALL guidance.
- Credentials remain server-side only.
- Frontend never stores provider secrets.

## Frontend diagnosis request shape

```jsonc
{
  "version": "2026-09-home-diy-v1",
  "scope": "home-diy-only",
  "category": "Plumbing | Electrical | Heating & Cooling | Appliance | Structural | Home Equipment | Doors & Windows | Other",
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
    "profileUpdatedAt": "ISO 8601 string",
    "selectedEquipment": {
      "id": "string",
      "type": "string",
      "manufacturer": "string",
      "modelNumber": "string",
      "serialNumber": "string",
      "installationDateOrAge": "string",
      "warrantyExpiration": "string",
      "warrantyDetails": "string",
      "notes": "string"
    },
    "maintenanceHistory": [{ "recordType": "maintenance", "servicePerformed": "string", "date": "string", "partsUsed": "string", "notes": "string" }],
    "previousRepairs": [{ "recordType": "repair", "servicePerformed": "string", "date": "string", "partsUsed": "string", "notes": "string" }],
    "homeSummary": {
      "nickname": "string",
      "yearBuilt": "string",
      "homeType": "string"
    }
  }
}
```

## Response shape expected by frontend UI

```jsonc
{
  "matched": true,
  "needsFollowUp": false,
  "confidence": { "level": "high | medium | low", "label": "string" },
  "hasDanger": false,
  "dangerConfig": { "level": "caution|stop", "badge": "string", "message": "string", "action": "string" },
  "possibleCauses": [{ "title": "string", "whyPossible": "string" }],
  "otherPossibleCauses": [{ "title": "string", "whyPossible": "string" }],
  "safeChecks": ["string"],
  "nextActions": ["string"],
  "tools": ["string"],
  "parts": ["string"],
  "safetyWarnings": ["string"],
  "whenToStopDIY": ["string"],
  "whenToCallProfessional": ["string"],
  "followUpQuestions": ["string"],
  "issue": {
    "causes": ["string"],
    "otherCauses": ["string"],
    "clarifyingQuestions": ["string"],
    "nextCheck": "string",
    "steps": ["string"],
    "tools": ["string"],
    "parts": ["string"],
    "time": "string",
    "difficulty": "easy-check | beginner | intermediate | advanced | professional | emergency",
    "tips": ["string"],
    "stopWhen": "string",
    "safety": "string",
    "pro": "string"
  },
  "category": "string"
}
```

## Safety and scope requirements enforced

- Home/DIY only (`home-diy-only`) — no automotive diagnosis.
- Do not provide unsafe guidance for fire, gas, CO, electrical shock, structural, hazardous-material, sewage, or major flooding conditions.
- Return clear STOP/CALL guidance whenever risk is high.
- Use My Home context only when provided; never invent equipment details.

## What still must be configured outside GitHub

1. Deploy backend runtime (for example Cloudflare Workers).
2. Set provider secret(s) in backend platform environment.
3. Set production `ALLOWED_ORIGINS`.
4. Configure frontend backend URL metadata to point at deployed backend.
5. Monitor usage, rate limit, and logging policies at hosting platform level.
