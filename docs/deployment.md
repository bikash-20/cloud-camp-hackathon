# Deployment

How to deploy the frontend (Vercel) and backend (Railway) so the
live PWA talks to the live backend.

## Overview

```
┌──────────────────────────────────┐
│  Vercel                          │
│  (frontend — Vite static build)  │   ← static SPA, auto-deploys
│  https://nutrivision.vercel.app  │     from `main` branch
└──────────────┬───────────────────┘
               │  HTTPS, VITE_API_BASE header at build time
               │  cross-origin fetch with credentials
               ▼
┌──────────────────────────────────┐
│  Railway / Render / Fly          │
│  (backend — FastAPI on uvicorn)  │   ← long-running service
│  https://nutrivision-api.railway │     with HTTPS + secrets
│  .app                            │
└──────────────┬───────────────────┘
               │
               ▼
       External APIs (Gemini, HF, OFF, USDA, Fruityvice)
```

Both halves are independent: the frontend is a static SPA, the
backend is a single FastAPI process. They communicate over HTTPS.

---

## Frontend — Vercel

Already wired. `vercel.json` at the repo root declares the build
command and output dir:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

Vercel auto-detects this. Every push to `main` triggers a new
deploy.

### Set the API base URL

In Vercel → Project Settings → Environment Variables:

| Name | Value | Notes |
|---|---|---|
| `VITE_API_BASE` | `https://<your-railway-app>.up.railway.app` | **No trailing slash.** Used by `src/lib/api.ts#apiFetch()` to route vision + nutrition calls. |

Set it for **Production**, **Preview**, and **Development** as
needed. Empty string = run on canned fixtures (no backend).

### First deploy / re-deploy

Vercel auto-deploys on push to `main`. To trigger a manual deploy
after changing env vars, use the Vercel dashboard "Redeploy"
button (uncheck "Use existing build cache" so the new env var
takes effect).

### Verify

Once deployed, open the PWA. The browser DevTools Network tab
should show `POST /api/vision/analyze` going to your Railway URL
when you capture a photo.

---

## Backend — Railway

The FastAPI app in `app/` is set up for Railway's Nixpacks builder
with **zero config**: Railway detects Python, reads
`requirements.txt`, and runs `uvicorn app.main:app --host 0.0.0.0
--port $PORT`.

### One-time setup

1. **Create a Railway project** at <https://railway.app>.
2. **Deploy from GitHub**: point Railway at this repo, set the
   **root directory** to `app/`. Railway will install
   `requirements.txt` and start uvicorn.
3. **Set environment variables** in the Railway dashboard:

   | Name | Value |
   |---|---|
   | `GEMINI_API_KEY` | `sk-...` (from <https://aistudio.google.com/app/apikey>) |
   | `HF_API_TOKEN` | `hf_...` (from <https://huggingface.co/settings/tokens>) |
   | `USDA_API_KEY` | `DEMO_KEY` (works without signup; rate-limited) |
   | `CORS_ALLOW_ORIGINS` | `https://nutrivision.vercel.app,http://localhost:5173` |
   | `STATE_PATH` | leave as default (`/app/state.json`) |
   | `PORT` | Railway sets this automatically |

4. **Set the start command** (under Settings → Deploy):
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

5. **Generate a domain**: Settings → Networking → Generate Domain.
   Railway gives you a `*.up.railway.app` URL.

### Verify

Once Railway has the deploy URL:

```bash
curl https://<your-app>.up.railway.app/
# {"service":"nutrivision-backend","cut":"a (contract-only skeleton)","docs":"/docs"}

curl https://<your-app>.up.railway.app/docs
# Swagger UI

# With keys set, a real call:
curl -X POST https://<your-app>.up.railway.app/api/vision/analyze \
  -H "Content-Type: application/json" \
  -d '{"image_ref": "data:image/jpeg;base64,/9j/4AAQ..."}'
```

### CORS

`CORS_ALLOW_ORIGINS` is comma-separated. For local dev + Vercel
production:
```
CORS_ALLOW_ORIGINS=http://localhost:5173,https://nutrivision.vercel.app
```

Without this, the browser will block cross-origin requests from
the Vercel frontend to the Railway backend.

### Persistent state

By default, `STATE_PATH=/app/state.json` is an **ephemeral**
filesystem on Railway — it gets wiped on every redeploy. For the
demo this is fine (state is per-session anyway, and the frontend
holds the source of truth in localStorage). For production
persistence, attach a Railway volume to `/app` and set
`STATE_PATH=/app/data/state.json`.

The ChromaDB vector cache and SQLite TTL cache have the same
limitation — they'll rebuild from real traffic after each redeploy,
which is harmless.

---

## End-to-end verification

After both deploys are live and `VITE_API_BASE` is set on Vercel:

1. Open the PWA on a phone (or a desktop with HTTPS).
2. Tap the camera button → take a photo.
3. Open DevTools → Network tab. You should see:
   ```
   POST https://<railway>.up.railway.app/api/vision/analyze  → 200
   POST https://<railway>.up.railway.app/api/nutrition/resolve  → 200
   ```
4. The Results screen should show the real detected items from
   Gemini + HF, with confidence scores from real numbers.
5. The Nutrients screen should show per-100g nutrition from the
   OFF → USDA → Fruityvice cascade (look at the `source` field
   on each `ResolvedItem` in DevTools).
6. Save the meal → verify it appears in the meal history.

If the live backend is unreachable, the app falls back to the
canned fixture and shows a "Pipeline offline — using sample data"
toast. Check the browser console for the underlying error.

---

## Rollback

If something goes wrong in production:

- **Frontend**: Vercel dashboard → Deployments → click the
  previous green deployment → "Promote to Production".
- **Backend**: Railway dashboard → Deployments → click the
  previous successful deploy → "Rollback".

The mock mode (`VITE_API_BASE=""`) also works as a frontend-only
rollback: set the env var to empty string, redeploy Vercel. The
app will use the canned fixtures without ever touching the
backend.

---

## Cost / quotas

| Service | Free tier | Demo cost |
|---|---|---|
| Vercel | Unlimited static deploys on hobby plan | $0 |
| Railway | $5/mo credit, ~500 hrs of `1GB/1vCPU` | ~$1-2/mo for cut-b demo traffic |
| Gemini 2.0 Flash | 15 RPM, 1M tokens/min | $0 for the demo |
| HuggingFace Inference | Free tier, ~1000 req/day | $0 |
| Open Food Facts | Free, no key | $0 |
| USDA FDC | Free, `DEMO_KEY` works | $0 |
| Fruityvice | Free, no key | $0 |

**Realistic demo cost: ~$1/mo** for a few-dozen-meals-a-day
deployment. Way under any hackathon budget.