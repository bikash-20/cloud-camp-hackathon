# Deployment

How to deploy the frontend (Vercel) and backend (Render) so the
live PWA talks to the live backend.

## Overview

```
┌──────────────────────────────────┐
│  Vercel                          │
│  (frontend — Vite static build)  │   ← static SPA, auto-deploys
│  https://cloud-camp-hackathon.vercel.app │ from `main` branch
└──────────────┬───────────────────┘
               │  HTTPS, VITE_API_BASE environment at build time
               │  cross-origin API requests
               ▼
┌──────────────────────────────────┐
│  Render                          │
│  (backend — FastAPI on uvicorn)  │   ← long-running service
│  <your-service>.onrender.com     │     with HTTPS + secrets
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
| `VITE_API_BASE` | `https://<your-render-service>.onrender.com` | **No trailing slash or `/api` suffix.** Used for vision + nutrition calls. |

Set it for **Production**, **Preview**, and **Development** as
needed. An empty value disables live backend calls; image analysis will
show an error rather than sample detections, while other demo state
remains browser-local.

### First deploy / re-deploy

Vercel auto-deploys on push to `main`. To trigger a manual deploy
after changing env vars, use the Vercel dashboard "Redeploy"
button (uncheck "Use existing build cache" so the new env var
takes effect).

### Verify

Once deployed, open the PWA. The browser DevTools Network tab
should show `POST /api/vision/analyze` going to your Render URL
when you capture a photo.

---

## Backend — Render

Create a Render Web Service from this GitHub repository.

### Service settings

| Setting | Value |
|---|---|
| Branch | `main` |
| Root directory | `.` (repository root) |
| Build command | `pip install -r app/requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/health` |

Set these service environment variables:

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | Newly generated Gemini key (required for Gemini vision) |
| `HF_API_TOKEN` | Optional Hugging Face token |
| `CORS_ALLOW_ORIGINS` | `https://cloud-camp-hackathon.vercel.app` |
| `USDA_API_KEY` | Optional; default is `DEMO_KEY` |
| `STATE_PATH` | Leave default unless using persistent storage |

Render assigns an HTTPS service URL after the first successful deploy.
Set Vercel's `VITE_API_BASE` to that URL (origin only), then redeploy
the frontend so Vite includes the new build-time variable.

### Verify

After Render has assigned the service URL:

```bash
curl https://<your-service>.onrender.com/health
# {"status":"ok"}

curl https://<your-service>.onrender.com/docs
# Swagger UI
```

### CORS

`CORS_ALLOW_ORIGINS` is comma-separated. For local dev + Vercel
production:
```
CORS_ALLOW_ORIGINS=http://localhost:5173,https://cloud-camp-hackathon.vercel.app
```

Without this, the browser will block cross-origin requests from
the Vercel frontend to the Render backend.

### Persistent state

The JSON state, ChromaDB cache, and SQLite cache are file-backed and
may be lost on redeploy or service replacement unless persistent disk
storage is configured. This is demo-scale state, not durable
multi-user persistence.

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
   POST https://<render-service>.onrender.com/api/vision/analyze  → 200
   POST https://<render-service>.onrender.com/api/nutrition/resolve  → 200
   ```
4. The Results screen should show detections from Gemini and optional
   HF validation, with confidence scores returned by the provider.
5. The Nutrients screen should show per-100g nutrition from the
   OFF → USDA → Fruityvice cascade (look at the `source` field
   on each `ResolvedItem` in DevTools).
6. Save the meal → verify it appears in the meal history.

If the live backend or provider is unavailable, the app shows an
analysis error and does not save or display a canned detection. Check
the browser console, backend health endpoint, CORS origin, and provider
environment variables.

---

## Rollback

If something goes wrong in production:

- **Frontend**: Vercel dashboard → Deployments → click the
  previous green deployment → "Promote to Production".
- **Backend**: Render dashboard → Events → select the
  previous successful deploy → "Rollback".

Setting `VITE_API_BASE` to an empty value disables backend calls, but
does not restore canned photo-analysis results. Use this only for
frontend-local/demo behavior.

---

## Cost / quotas

| Service | Free tier | Demo cost |
|---|---|---|
| Vercel | Unlimited static deploys on hobby plan | $0 |
| Render | Free service may sleep while idle | Depends on service plan and usage |
| Gemini 2.0 Flash | 15 RPM, 1M tokens/min | $0 for the demo |
| HuggingFace Inference | Free tier, ~1000 req/day | $0 |
| Open Food Facts | Free, no key | $0 |
| USDA FDC | Free, `DEMO_KEY` works | $0 |
| Fruityvice | Free, no key | $0 |

**Realistic demo cost: ~$1/mo** for a few-dozen-meals-a-day
deployment. Way under any hackathon budget.