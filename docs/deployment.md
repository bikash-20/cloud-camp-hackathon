# Production Deployment Guide

This guide covers deploying the **NutriVision AI** frontend (Vercel), backend (Render), PostgreSQL database (Neon / Supabase / Render), and Google OAuth credentials.

---

## Architecture Topology

```
┌──────────────────────────────────────┐
│  Google Cloud Console                │
│  • OAuth 2.0 Web Client              │
│  • Authorized JS Origins:            │
│    https://cloud-camp-hackathon.     │
│    vercel.app                        │
└──────────────────┬───────────────────┘
                   │ Client ID
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐   ┌──────────────────────────────────┐
│  Vercel          │   │  Render                          │
│  Frontend (PWA)  │──▶│  FastAPI Backend Service         │
│  • React 18      │   │  • Uvicorn async worker          │
│  • Static Build  │   │  • JWT Auth & Vision Cascade     │
└──────────────────┘   └─────────────────┬────────────────┘
                                         │
                                         ▼
                       ┌──────────────────────────────────┐
                       │  Neon / Managed PostgreSQL       │
                       │  • Transaction Pooler (-pooler)  │
                       │  • SSL & Channel Binding         │
                       │  • Auto-migrated schema          │
                       └──────────────────────────────────┘
```

---

## 1. Google Cloud Console (OAuth 2.0)

1. Open [Google Cloud Console](https://console.cloud.google.com/) $\rightarrow$ **APIs & Services** $\rightarrow$ **Credentials**.
2. Click **Create Credentials** $\rightarrow$ **OAuth Client ID**.
3. Select **Application type:** `Web application`.
4. Name: `NutriVision AI Web Client`.
5. Under **Authorized JavaScript origins**, add:
   - `https://cloud-camp-hackathon.vercel.app` (Production)
   - `http://localhost:5173` (Local development)
   - `http://localhost:4173` (Vite preview)
6. Under **Authorized redirect URIs**: Leave empty (NutriVision AI utilizes Google Identity Services ID-token flow; no server redirect URI is required).
7. Copy the generated **Client ID** (e.g. `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`).

---

## 2. Managed PostgreSQL (Neon / Supabase / Render)

NutriVision AI uses `psycopg 3` with automatic DDL table migrations on startup.

### Recommended Provider: Neon Serverless Postgres
1. Create a project in [Neon Console](https://console.neon.tech/).
2. On the **Dashboard**, locate your connection details and select the **Pooled connection** checkbox (`-pooler`).
3. Construct the connection URI:
   ```text
   postgresql://[user]:[password]@[endpoint]-pooler.[region].neon.tech/neondb?sslmode=require&channel_binding=require
   ```
4. **Key Compatibility Features:**
   - **Transaction Pooling:** Handled automatically via `prepare_threshold=None` in `app/services/state.py`.
   - **Channel Binding:** `channel_binding=require` validates the `SCRAM-SHA-256-PLUS` token against the TLS certificate.
   - **Auto-migrations:** Automatically creates `nv_users`, `nv_meals`, and `nv_grocery` on boot.

---

## 3. Backend Deployment (Render)

1. Create a **New Web Service** connected to your GitHub repository.
2. Configure service settings:
   - **Environment:** `Python 3`
   - **Branch:** `main`
   - **Root Directory:** `.`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path:** `/health`
3. Configure **Environment Variables** in Render:

| Variable | Recommended Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@ep-pooler.neon.tech/neondb?sslmode=require&channel_binding=require` | Persistent PostgreSQL store |
| `GOOGLE_CLIENT_ID` | `xxxxxxxx.apps.googleusercontent.com` | Matches Google Console |
| `JWT_SECRET` | `openssl rand -hex 32` | 64-char random hex string |
| `ADMIN_EMAILS` | `bikashtalukder040@gmail.com,admin@nutrivision.ai` | Admin permissions grant |
| `CORS_ALLOW_ORIGINS` | `https://cloud-camp-hackathon.vercel.app` | Allow frontend origin |
| `GROQ_API_KEY` | `gsk_...` | Tier 1 Fast Vision |
| `GEMINI_API_KEY` | `AIzaSy...` | Tier 2 High-Accuracy Vision |
| `OPENROUTER_API_KEY` | `sk-or-...` | Tier 3 Vision Cascade |
| `USDA_API_KEY` | `DEMO_KEY` (or custom key) | USDA FoodData Central |

4. Deploy the service and record the assigned HTTPS domain:
   `https://cloud-camp-hackathon.onrender.com`

---

## 4. Frontend Deployment (Vercel)

1. Connect the GitHub repository to [Vercel](https://vercel.com/).
2. Root configuration is handled automatically by `vercel.json`:
   - Framework: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. In **Project Settings** $\rightarrow$ **Environment Variables**, configure:

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_BASE` | `https://cloud-camp-hackathon.onrender.com` | **No trailing slash**, no `/api` suffix |
| `VITE_GOOGLE_CLIENT_ID` | `xxxxxxxx.apps.googleusercontent.com` | Same Client ID as backend |

4. Click **Redeploy** (with "Use existing build cache" unchecked) to bake the new environment variables into the Vite client bundle.

---

## 5. Verification Checklist

1. **Health Check:**
   ```bash
   curl -s https://cloud-camp-hackathon.onrender.com/health | jq .
   # Expected: {"status": "ok", "service": "nutrivision-backend"}
   ```
2. **Google Sign-In Flow:**
   - Open `https://cloud-camp-hackathon.vercel.app`.
   - Click **"Continue with Google"**.
   - Verify that your real Google email and name appear on the Profile screen.
   - Verify that new accounts start with clean 0 stats (0 meals, 0 active days, 0 streak).
3. **Admin Dashboard Flow:**
   - Sign in using an email configured in `ADMIN_EMAILS`.
   - Verify the 4 active tabs: **Overview** (with real 7-day sparkline), **Users**, **Popular Foods**, and **Review Queue**.
   - Verify that non-admin accounts receive `403 Forbidden` if attempting to access admin APIs.
4. **Theme Rendering:**
   - Switch between Light and Dark mode.
   - Refresh the page and confirm zero white flash on dark theme.
