# A to Z Wise AI secure diagnosis backend

This folder contains a server-side backend foundation for `POST /api/diagnose`.

## What it does

- Accepts the existing front-end diagnosis contract (`multipart/form-data` with `request` JSON + optional `photos`).
- Enforces `scope: "home-diy-only"` and rejects unsupported categories.
- Applies safety-first guardrails with immediate STOP/CALL responses for obvious high-risk conditions.
- Sends diagnosis generation to an AI provider server-side only using environment secrets.
- Returns structured diagnosis fields already expected by the current UI.

## Deploy target

The provided entrypoint (`backend/worker.mjs`) is designed for Cloudflare Workers. This repo now includes:

- repository-root `wrangler.toml` for Cloudflare Git-connected Worker deployments
- `backend/wrangler.toml` for manual/local Wrangler deploys from the `backend/` folder

## Required environment variables

Set these in your backend platform (never in frontend code and never in git):

- `AI_PROVIDER_API_KEY` (required, secret)
- `AI_PROVIDER_MODEL` (optional, default: `gpt-4o-mini`)
- `AI_PROVIDER_BASE_URL` (optional, default: `https://api.openai.com/v1`)
- `ALLOWED_ORIGINS` (required for production browser access, comma-separated CORS allowlist)

For OpenAI-compatible deployments, `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_BASE_URL`
are also accepted.

## Frontend connection

After deployment, set your backend base URL in:

- `<meta name="atozwiseai-backend-url" content="https://your-backend-domain">` in `index.html`, or
- `window.ATOZWISEAI_CONFIG.backendUrl` at runtime.

Legacy `fixwise-backend-url` and `window.FIXWISE_CONFIG.backendUrl` are still supported.

The frontend already calls `${backendUrl}/api/diagnose` and safely falls back to Demo Mode if unavailable.

## Deploy (Cloudflare Workers)

1. For Cloudflare Git-connected Worker deploys, keep the project root at the repository root so Cloudflare reads `/wrangler.toml`.
2. Use these Cloudflare settings:
   - Root directory: repository root
   - Wrangler config: `wrangler.toml`
   - Build command: `echo "No build step required"`
   - Deploy command: `npx wrangler deploy`
3. Review repository-root `wrangler.toml` (entrypoint, allowed origins, optional model/base URL).
   - `main = "backend/worker.mjs"` keeps the runtime code in the existing backend Worker.
   - Keep production origins only by default: `https://atozwiseai.com,https://www.atozwiseai.com`.
   - If needed for GitHub Pages testing, temporarily add `https://ac7596.github.io`, then remove it after testing.
4. Set secret in Cloudflare Variables and Secrets:
   - `AI_PROVIDER_API_KEY`
5. If you prefer manual/local Wrangler deploys instead, use:
   - `cd backend`
   - `wrangler secret put AI_PROVIDER_API_KEY`
   - `wrangler deploy`
6. In Cloudflare dashboard, map `api.atozwiseai.com/*` (or another HTTPS domain) to this Worker.
7. Validate:
   - `GET https://<your-backend-domain>/api/health`
8. Point frontend to backend:
   - In `/index.html`, set `<meta name="atozwiseai-backend-url" content="https://<your-backend-domain>">`

If the backend is unavailable or misconfigured, frontend remains safe and transparent by falling back to Demo Mode.

## Local smoke check (Node 20+)

You can import and test backend helpers directly via `node tests/regression-secure-backend-service.mjs`.
