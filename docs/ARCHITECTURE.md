# NutriVision AI System Architecture

This document specifies the end-to-end technical architecture, component boundaries, data pipelines, and operational invariants of **NutriVision AI**.

---

## 1. System Overview

NutriVision AI is an AI-native, phone-first nutrition intelligence platform connecting visual ingestion of meals to clinical metabolic calculations and real-time localized market supply chains (the *Vision-to-Market* loop).

The platform is designed around a strictly decoupled client-server architecture:
- **Frontend Client:** React 18 + TypeScript Progressive Web App (PWA) with responsive design, pre-paint theme hydration, Google Identity Services authentication, and localized English/Bengali UI. Deployed statically to Vercel.
- **Backend Service:** Asynchronous FastAPI service written in Python 3.11+, providing stateless REST APIs, Google OAuth ID token verification, multi-tier multimodal LLM cascades, dynamic clinical calculations, and multi-tenant persistence. Deployed as a web service on Render.
- **Durable Persistence:** PostgreSQL storage layer (optimized for Neon, Supabase, or Render Postgres) via `psycopg 3` with automatic DDL migrations, transaction pooler compatibility, and channel binding.

---

## 2. High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER (PWA)                           │
│                                                                          │
│  ┌───────────────────────────┐         ┌──────────────────────────────┐  │
│  │   Vite + React 18 SPA     │         │ Google Identity Services     │  │
│  │  • Theme Engine (Zero-FL) │         │ • One-Tap & Sign-In Button   │  │
│  │  • Bengali / English i18n │         │ • Issues RS256 ID Token      │  │
│  └─────────────┬─────────────┘         └──────────────┬───────────────┘  │
│                │                                      │                  │
│                ▼                                      ▼                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                       Application Router                           │  │
│  │  ┌───────────────────────────────┐  ┌────────────────────────────┐ │  │
│  │  │ User PWA (6 Tabs)             │  │ Admin Dashboard (4 Views)  │ │  │
│  │  │ • Capture (Camera & Curve)    │  │ • Overview (Live Metrics)  │ │  │
│  │  │ • Results (Detected & Sort)   │  │ • Users (Directory & Modal)│ │  │
│  │  │ • Nutrients (Pivots & Donuts) │  │ • Popular Foods (Rankings) │ │  │
│  │  │ • Profile (Clinical Goals)    │  │ • Review Queue (Audit)     │ │  │
│  │  │ • Grocery (Category & Budget) │  │                            │ │  │
│  │  │ • Coach (Dr. Susmit AI)       │  │                            │ │  │
│  │  └───────────────────────────────┘  └────────────────────────────┘ │  │
│  └──────────────────────────────────┬─────────────────────────────────┘  │
│                                     │ HTTPS + JSON                        │
│                                     │ Authorization: Bearer <JWT>         │
└─────────────────────────────────────┼────────────────────────────────────┘
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            API BACKEND (FastAPI)                         │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                      API Routing & Middleware                      │  │
│  │  • CORS & Body Limits    • JWT Authentication & Role Authorization │  │
│  └─────────────┬──────────────────────────────────────────────────────┘  │
│                │                                                         │
│  ┌─────────────┴───────────┬─────────────┬─────────────┬──────────────┐  │
│  │                         │             │             │              │  │
│  ▼                         ▼             ▼             ▼              ▼  │
│ ┌──────────────┐   ┌──────────────┐ ┌─────────┐ ┌──────────────┐ ┌─────────┐│
│ │/api/auth     │   │/api/vision   │ │/api/    │ │/api/nutrition│ │/api/    ││
│ │• Google JWKS │   │• 5-Tier      │ │admin    │ │• Mifflin-St  │ │coach    ││
│ │  Token Check │   │  Cascade     │ │• Metrics│ │  Jeor BMR    │ │• RAG    ││
│ │• JWT Issuance│   │• Portion BBox│ │• Review │ │• AMDR Splits │ │• 3-Tier ││
│ └──────┬───────┘   └──────┬───────┘ └────┬────┘ └──────┬───────┘ │  TTS    ││
│        │                  │              │             │         └───┬─────┘│
│        └──────────────────┼──────────────┴─────────────┴─────────────┘      │
│                           ▼                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │           State Store & Persistence (app/services/state.py)        │     │
│  │                                                                    │     │
│  │  ┌───────────────────────────────┐   ┌──────────────────────────┐  │     │
│  │  │ Dual-Mode Adapter             │   │ Vector & Cache Layer     │  │     │
│  │  │ • PostgreSQL (`psycopg 3`)    │   │ • ChromaDB Image & RAG   │  │     │
│  │  │   - Auto DDL Migrations       │   │ • SQLite TTL Fast Cache  │  │     │
│  │  │   - Connection Pooling        │   └──────────────────────────┘  │     │
│  │  │   - Transaction Pool Safe     │                                 │     │
│  │  │ • Local JSON Fallback         │                                 │     │
│  │  └───────────────────────────────┘                                 │     │
│  └────────────────────────┬───────────────────────────────────────────┘     │
└───────────────────────────┼─────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           INFRASTRUCTURE & DATA                          │
│                                                                          │
│  ┌─────────────────────────────────┐  ┌────────────────────────────────┐ │
│  │ Managed PostgreSQL (Neon / Supa)│  │ External AI & Vision Services  │ │
│  │ • `nv_users` (Identities & Roles│  │ • Groq LPU (Llama 3.2 Vision)  │ │
│  │ • `nv_meals` (Photos & Logs)    │  │ • Google Gemini 2.0 Flash      │ │
│  │ • `nv_grocery` (Items & Status) │  │ • OpenRouter / Hugging Face    │ │
│  └─────────────────────────────────┘  └────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────────────────┐  ┌────────────────────────────────┐ │
│  │ External Nutrition Intelligence │  │ Speech & Audio Synthesis       │ │
│  │ • USDA FoodData Central         │  │ • ElevenLabs Premade TTS       │ │
│  │ • Open Food Facts • Fruityvice  │  │   (George/Sarah low-latency)   │ │
│  │ • Localized BD Food Database    │  │ • Server-Side edge-tts Neural  │ │
│  │ • Chaldal / TCB Price Engine    │  │ • Web Speech API (Client STT)  │ │
│  └─────────────────────────────────┘  └────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. End-to-End Data Flows

### A. Authentication & Onboarding Lifecycle
1. User clicks **"Continue with Google"** on the frontend login screen.
2. Google Identity Services authenticates the user and returns a signed OpenID Connect ID token (`credential`).
3. Frontend dispatches `POST /api/auth/google` with `{ credential }`.
4. Backend fetches Google's public certificates via JWKS, validates token signature, expiration (`exp`), and audience (`aud == GOOGLE_CLIENT_ID`).
5. Backend resolves user:
   - If user exists, updates `last_active`.
   - If user is new, creates a pristine user profile partition in PostgreSQL (`nv_users`) with zero pre-populated meals or synthetic stats.
   - Assigns role `admin` if email is in `ADMIN_EMAILS`, otherwise `user`.
6. Backend signs an HMAC-SHA256 session JWT and returns it with user profile metadata.
7. Frontend stores the session token in `localStorage['nv_auth']` and attaches `Authorization: Bearer <token>` to subsequent API calls.

### B. Vision-to-Market Processing Loop
1. **Visual Ingestion:** User captures a cooked meal, produce, or restaurant menu via camera (`getUserMedia`). The photo is converted to JPEG base64.
2. **Analysis (`POST /api/vision/analyze`):**
   - Backend computes SHA-256 image digest and queries ChromaDB vector cache and SQLite TTL cache.
   - If cold, runs the 5-tier vision cascade: **Groq Vision** (Tier 1 LPU) $\rightarrow$ **Gemini 2.0 Flash** (Tier 2 Primary) $\rightarrow$ **OpenRouter** (Tier 3 Cascade) $\rightarrow$ **Gemini 1.5** (Tier 4 Fallback) $\rightarrow$ **Hugging Face** (Tier 5 Classifier).
   - Reconciles candidate food items and calculates portion grammage from bounding box volume densities.
3. **Clinical Nutrition Resolution (`POST /api/nutrition/resolve`):**
   - Food descriptors are matched across the canonical Bangladeshi composition database, Open Food Facts, and USDA FoodData Central.
   - Resolves micronutrients (fiber, sodium, sugar, glycemic index) and flags contraindications against the user's active health profile (diabetic, hypertension, renal).
4. **Market Intelligence & Dietary Pivot:**
   - Frontend and backend pivot engines calculate high-protein/low-sodium/budget meal swaps with exact macro and BDT price deltas.
   - User adds ingredients to localized weekly grocery list with 1 tap.
5. **Durable Persistence:** Confirmed meal is written to PostgreSQL (`nv_meals`), triggering updates to the home intake spline curve and user streak counters.

### C. Admin Observability & Audit Pipeline
1. **Metrics Aggregation (`GET /api/admin/metrics`):**
   - Aggregates live user counts (registered, active 7d, new today) and meal counts.
   - Generates a 7-day daily meal volume distribution for the responsive admin sparkline.
   - Calculates low-confidence flagged meal ratios across real database records.
2. **Review Queue Audit (`GET /api/admin/review-queue`):**
   - Isolates meals detected with confidence $<70\%$.
   - Admin can approve, dismiss, or correct food labels via `PATCH /api/admin/review-queue/{meal_id}`, retraining/correcting the system logs.

### D. Multi-Agent AI Coach & Voice Assistant Pipeline
1. **Voice Ingestion & STT:**
   - User speaks into the browser microphone via Web Speech API (`SpeechRecognition`).
   - A dedicated `[বাং / EN]` toggle pill enables instant switching between `bn-BD` and `en-US` speech models on the fly.
2. **Context Compilation & Live DB Grounding:**
   - Client sends `POST /api/coach/voice-chat` or `POST /api/coach/tts` transparently proxied via Vercel edge rewrite (`/api/:path*` $\rightarrow$ Render backend).
   - Backend looks up `nv_users` (biometrics, condition flags, calorie limits), `nv_meals` (today's logged meals and remaining intake budget), and `nv_grocery` (active pantry inventory).
   - If pantry or meal logs are empty, null-safe defaults are populated without failing.
   - Clinical RAG retrieves evidence-based BIRDEM/ADA dietary guidelines and WHO behavioral habit loop strategies.
3. **Single-Pass Dual-Channel Inference:**
   - A single LLM pass synthesizes both a full, structured clinical Markdown card and an ultra-concise spoken summary (`voice_summary`, <60 words, clean of Markdown, LaTeX, and emojis) separated by `===VOICE_SUMMARY===`.
4. **Persona-Aware Dual-Voice Routing:**
   - The user selects between two distinct coaching agents:
     - **🔬 Dr. Susmit (Scientist):** Male Nutritional Biochemist. ElevenLabs premade voice `JBFqnCBsd6RMkjVDRZzb` (George).
     - **🧠 Farhana Ahmed (Habit Coach):** Female Behavioral & Habit Coach. ElevenLabs premade voice `EXAVITQu4vr4xnSDxMaL` (Sarah).
   - Legacy library voice IDs (e.g., `21m00Tcm4TlvDq8ikWAM`) are strictly ignored even if set in environment variables, completely eliminating ElevenLabs Free Tier HTTP 402 errors.
5. **Tiered Speech Synthesis Engine (`app/services/tts_service.py`):**
   - **Tier 1 (ElevenLabs Low-Latency Premade TTS):**
     - English synthesized with `eleven_flash_v2_5` (~75ms TTFA).
     - Bengali Unicode script (`\u0980-\u09FF`) or `lang="bn"` automatically routes to `eleven_multilingual_v2`.
     - In-flight automatic retry on HTTP 400/402 with default premade voice.
     - 128-slot thread-safe in-memory LRU cache avoids duplicate billing.
   - **Tier 2 (Server-Side Neural TTS via `edge-tts`):**
     - If ElevenLabs is unconfigured, rate-limited, or fails, server synthesizes neural MP3 audio with zero API keys required.
     - Persona gender & language matched:
       - Dr. Susmit (Male): `en-US-AndrewNeural` (EN) / `bn-BD-PradeepNeural` (BN).
       - Farhana (Female): `en-US-AvaNeural` (EN) / `bn-BD-NabanitaNeural` (BN).
     - Non-blocking execution via isolated background thread event loop (`_run_async_in_thread`).
   - **Tier 3 (Client Browser Fallback):**
     - If both server tiers are unavailable, returns `use_browser_tts = True` and `audio_base64 = null`, triggering client-side `window.speechSynthesis`.
6. **On-Demand `🔊 Listen` Button Flow:**
   - When a user clicks `🔊 Listen` on any chat bubble, the frontend checks its local `audioCacheRef` before calling `POST /api/coach/tts`.
   - The server resolves the persona voice, synthesizes or retrieves the audio, and returns `audio_base64` and a `tts_diagnostic` tag (e.g. `elevenlabs_flash_v2_5`, `edge_tts_fallback`, `browser_tts_client`).
   - The client plays the MP3 stream via HTML5 `Audio()` and animates the speaker icon during playback.

---

## 4. Key Architectural Invariants

The codebase strictly enforces the following principles:

1. **Schema Lockstep Synchronization:**
   - `src/types/schemas.ts` and `app/models/schemas.py` are the unified wire contracts.
   - Enforced automatically by `app/tests/test_schema_drift.py` which inspects TypeScript AST and Pydantic models. CI rejects any mismatched PR.

2. **Strict Multi-Tenant Isolation:**
   - All user data (`profile`, `meals`, `grocery`) is partitioned by verified user email.
   - Zero cross-user visibility. Admin endpoints require verified admin role (`403 Forbidden` for standard users).

3. **No Mock or Synthetic Personas in Production:**
   - All runtime execution paths use verified Google authenticated accounts.
   - Startup migrations automatically purge legacy mock/synthetic accounts (`judge`, `rafi`, `@nutrivision.ai`). Real accounts with meals are never touched.

4. **Zero-Flash Theme Rendering & High-Contrast Design:**
   - Synchronous script execution in `<head>` before CSS/DOM hydration guarantees dark mode renders without white flashes on reload.
   - All dark mode surfaces enforce WCAG AA 4.5:1 contrast minimums across chart containers, profile steppers, and coach bubbles. Default theme is explicitly light mode.

5. **Resilient Database Connectivity & Fail-Loud Storage:**
   - PostgreSQL connections via `psycopg 3` enforce `prepare_threshold=None` for transaction poolers (Neon, PgBouncer).
   - SCRAM-SHA-256 channel binding (`channel_binding=require`) is enforced for TLS connection integrity.
   - If `DATABASE_URL` is configured but connectivity or migrations fail, the service logs the error and refuses startup or returns 503 rather than silently degrading to JSON storage.
   - `GET /api/health` reports storage backend type and database connectivity without exposing connection secrets.

6. **Zero-Crash Graceful Voice Degradation:**
   - Text-to-speech failures or quota limits never produce 500 API errors; client seamlessly falls back to local browser speech synthesis.
