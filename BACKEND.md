# Secure AI backend foundation for A to Z Wise AI

A to Z Wise AI now includes a **server-side backend foundation** for AI diagnosis in `backend/worker.mjs` and `backend/diagnosis-service.mjs`.

GitHub Pages stays static and public. **No AI provider key belongs in the frontend or repository files shipped to browsers.**

## What is implemented in this repository

- `POST /api/diagnose` backend endpoint for diagnosis requests.
- Accepts the existing frontend contract (`multipart/form-data` with `request` JSON and optional `photos`).
- Enforces `scope: "home-diy-only"` and rejects unsupported categories.
- Uses server-side environment variables for AI provider credentials.
- Applies safety-first hazard detection and returns immediate STOP/CALL guidance for high-risk inputs.
- Returns structured diagnosis output compatible with the existing UI rendering.
- Keeps the existing frontend demo fallback behavior if backend is unavailable.

## Backend files

- `backend/worker.mjs` — HTTP routing, CORS, payload parsing, response handling.
- `backend/diagnosis-service.mjs` — request validation, guardrails, provider call, response normalization.
- `backend/wrangler.example.toml` — example Cloudflare Worker config (no secrets).
- `backend/README.md` — deployment and configuration quick-start.

## Required backend environment variables

Set these on your backend platform (not in git):

- `AI_PROVIDER_API_KEY` (required secret)
- `AI_PROVIDER_MODEL` (optional, default `gpt-4o-mini`)
- `AI_PROVIDER_BASE_URL` (optional, default `https://api.openai.com/v1`)
- `ALLOWED_ORIGINS` (recommended CORS allowlist)

OpenAI-compatible aliases are also supported:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`

## Frontend-to-backend connection

Frontend code already posts to `${backendUrl}/api/diagnose` in `js/api/ai-client.js`.

Set backend URL in one non-secret place:

- `<meta name="fixwise-backend-url" content="https://your-backend-domain">` in `index.html`, or
- `window.FIXWISE_CONFIG.backendUrl` at runtime.

If backend is not reachable, frontend automatically falls back to Demo Mode so the public site keeps working.

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
