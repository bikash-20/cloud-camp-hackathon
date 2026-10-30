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
│  ┌─────────────┴───────────┬───────────────────────────┬──────────────┐  │
│  │                         │                           │              │  │
│  ▼                         ▼                           ▼              ▼  │
│ ┌──────────────┐   ┌──────────────┐   ┌─────────────┐   ┌──────────────┐ │
│ │/api/auth     │   │/api/vision   │   │/api/admin   │   │/api/nutrition│ │
│ │• Google JWKS │   │• 5-Tier      │   │• Telemetry  │   │• Mifflin-St  │ │
│ │  Token Check │   │  Cascade     │   │• Directory  │   │  Jeor BMR    │ │
│ │• JWT Issuance│   │• Portion BBox│   │• Audit Queue│   │• AMDR Splits │ │
│ └──────┬───────┘   └──────┬───────┘   └──────┬──────┘   └──────┬───────┘ │
│        │                  │                  │                 │         │
│        └──────────────────┼──────────────────┴─────────────────┘         │
│                           ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │           State Store & Persistence (app/services/state.py)        │  │
│  │                                                                    │  │
│  │  ┌───────────────────────────────┐   ┌──────────────────────────┐  │  │
│  │  │ Dual-Mode Adapter             │   │ Vector & Cache Layer     │  │  │
│  │  │ • PostgreSQL (`psycopg 3`)    │   │ • ChromaDB Image Cache   │  │  │
│  │  │   - Auto DDL Migrations       │   │ • SQLite TTL Fast Cache  │  │  │
│  │  │   - Connection Pooling        │   └──────────────────────────┘  │  │
│  │  │   - Transaction Pool Safe     │                                 │  │
│  │  │ • Local JSON Fallback         │                                 │  │
│  │  └───────────────────────────────┘                                 │  │
│  └────────────────────────┬───────────────────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────────────────┘
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
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ External Nutrition & Market Intelligence                            │ │
│  │ • USDA FoodData Central • Open Food Facts • Fruityvice              │ │
│  │ • Localized BD Food Composition DB • Chaldal / TCB Price Engine     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
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
   - Startup migrations automatically purge legacy mock/synthetic accounts (`judge`, `rafi`, `@nutrivision.ai`).

4. **Zero-Flash Theme Rendering:**
   - Synchronous script execution in `<head>` before CSS/DOM hydration guarantees dark mode renders without white flashes on reload.
   - All dark mode surfaces enforce WCAG AA 4.5:1 contrast minimums.

5. **Resilient Database Connectivity:**
   - PostgreSQL connections via `psycopg 3` enforce `prepare_threshold=None` for transaction poolers (Neon, PgBouncer).
   - SCRAM-SHA-256 channel binding (`channel_binding=require`) is enforced for TLS connection integrity.
