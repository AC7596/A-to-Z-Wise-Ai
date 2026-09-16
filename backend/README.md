# A to Z Wise AI secure diagnosis backend foundation

This folder contains a server-side backend foundation for `POST /api/diagnose`.

## What it does

- Accepts the existing front-end diagnosis contract (`multipart/form-data` with `request` JSON + optional `photos`).
- Enforces `scope: "home-diy-only"` and rejects unsupported categories.
- Applies safety-first guardrails with immediate STOP/CALL responses for obvious high-risk conditions.
- Sends diagnosis generation to an AI provider server-side only using environment secrets.
- Returns structured diagnosis fields already expected by the current UI.

## Deploy target

The provided entrypoint (`backend/worker.mjs`) is designed for Cloudflare Workers-style runtimes.

## Required environment variables

Set these in your backend platform (never in frontend code and never in git):

- `AI_PROVIDER_API_KEY` (required, secret)
- `AI_PROVIDER_MODEL` (optional, default: `gpt-4o-mini`)
- `AI_PROVIDER_BASE_URL` (optional, default: `https://api.openai.com/v1`)
- `ALLOWED_ORIGINS` (optional but recommended, comma-separated CORS allowlist)

For OpenAI-compatible deployments, `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_BASE_URL`
are also accepted.

## Frontend connection

After deployment, set your backend base URL in:

- `<meta name="fixwise-backend-url" content="https://your-backend-domain">` in `index.html`, or
- `window.FIXWISE_CONFIG.backendUrl` at runtime.

The frontend already calls `${backendUrl}/api/diagnose` and safely falls back to Demo Mode if unavailable.

## Local smoke check (Node 20+)

You can import and test backend helpers directly via `node --test tests/regression-secure-backend-service.mjs`.
