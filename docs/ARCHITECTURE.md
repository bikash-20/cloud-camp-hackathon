# Architecture

A 30,000-ft view of the system. If you read one file in this folder,
read this one.

## What this is

NutriVision AI is a phone-first Progressive Web App that uses AI vision
to identify foods in a photo, resolve per-100g nutrition, personalize
health flags against the user's profile, and generate a budget-aware
grocery list from the user's meal history.

It is split into two halves:

- **Frontend** — React 18 + Vite + TypeScript PWA in `src/`. Currently
  uses a mock API client; designed to swap to real `fetch()` calls
  without UI changes.
- **Backend** — FastAPI + Pydantic v2 in `app/`. Wired to Gemini 2.0
  Flash (primary vision), HuggingFace (validator), and a nutrition
  cascade (Open Food Facts → USDA → Fruityvice).

## System diagram

```
                    ┌──────────────────────────────────────────────┐
                    │  Browser (PWA)                                │
                    │                                               │
   ┌─────────┐      │  ┌─────────────┐  ┌────────────────────────┐ │      ┌──────────────────┐
   │  User   │─────▶│  │  Capture    │  │ React 18 + framer-     │ │      │ localStorage     │
   │ (phone) │      │  │  Screen     │─▶│ motion app (App.tsx)   │─┼─────▶│  • profile       │
   └─────────┘      │  │ (camera)    │  │  5 tabs + admin route  │ │      │  • meal_history  │
                    │  └─────────────┘  │                        │ │      │  • grocery       │
                    │         │         │  Mock API: src/lib/    │ │      │  • nv_auth       │
                    │         │ dataURL │  api.ts (swap target)  │ │      └──────────────────┘
                    │         ▼         └────────────┬───────────┘ │
                    │  ┌─────────────┐               │             │
                    │  │ <img>       │               │             │
                    │  │ preview     │               │             │
                    │  └─────────────┘               │             │
                    └───────────────────────────────┼─────────────┘
                                                    │ JSON
                                                    │ (CORS preflight + POST)
                                                    ▼
                    ┌──────────────────────────────────────────────┐
                    │  FastAPI (uvicorn :8000)                      │
                    │  app/main.py                                 │
                    │                                               │
                    │  Routers:                                    │
                    │    /api/vision/*      →  app/api/vision.py    │
                    │    /api/nutrition/*   →  app/api/nutrition.py │
                    │    /api/profile/*     →  app/api/profile.py   │
                    │    /api/grocery/*     →  app/api/grocery.py   │
                    │    /api/meals/*       →  app/api/meals.py     │
                    │                                               │
                    │  State:                                       │
                    │    app/services/state.py  (JSON file singleton)│
                    │    app/cache/sqlite_cache.py  (TTL exact)     │
                    │    app/cache/vector_cache.py (ChromaDB)       │
                    │                                               │
                    │  External HTTP:                               │
                    │    services/gemini_client.py   → Gemini 2.0   │
                    │    services/hf_client.py        → HF Inference │
                    │    services/off_client.py       → OpenFF      │
                    │    services/usda_client.py      → USDA FDC    │
                    │    services/fruityvice_client.py → Fruityvice │
                    └────────────┬──────────────────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────────────────────────┐
                    │  External services                            │
                    │  • Google Gemini 2.0 Flash  (vision)          │
                    │  • HuggingFace Inference  (validator)        │
                    │  • Open Food Facts  (nutrition, no key)       │
                    │  • USDA FoodData Central  (nutrition, DEMO_KEY)│
                    │  • Fruityvice  (fruit, no key)                │
                    └──────────────────────────────────────────────┘
```

## Data flow (one sentence per stage)

1. **User opens the app** → `App.tsx` reads `nv_auth` from localStorage, shows the login screen or the appropriate app surface (user PWA / admin dashboard).
2. **User taps "Capture"** → `CaptureScreen` opens a `getUserMedia` stream (rear camera preferred), the user takes a photo, the photo becomes a JPEG data URL via `canvas.toDataURL('image/jpeg', 0.92)`.
3. **App calls `analyzeMeal(dataUrl)`** → currently a mock in `src/lib/api.ts`; once swapped, this will `POST /api/vision/analyze` with `{ image_ref: dataUrl }`.
4. **Backend** runs the vision pipeline (cache → Gemini || HF → reconcile → portion), returns `{ detected: DetectedItem[], pipeline: PipelineTrace[] }`.
5. **App calls `resolveNutrition(items, profile)`** → mock resolves per-100g nutrition from `MOCK_NUTRITION_DB` and runs the flag rules; real backend hits `/api/nutrition/resolve` which calls OFF → USDA → Fruityvice.
6. **User edits + confirms** → the app builds a `MealEntry` and calls `saveMeal(meal)` (persists to localStorage; real backend also persists to `app/state.json`).
7. **User navigates to Grocery** → `GroceryScreen` reads/writes the grocery list, can `generateFromMeals()` to add pairings from the meal history.

See [IMAGE_UPLOAD_FLOW.md](./IMAGE_UPLOAD_FLOW.md) for a frame-by-frame trace.

## Key invariants

These are the rules the codebase enforces. Breaking any of them is
a bug:

- **Schema lockstep.** `src/types/schemas.ts` and `app/models/schemas.py` are kept in sync by the schema-drift test (`app/tests/test_schema_drift.py`). CI runs the test on every push; see [schemas.md](./schemas.md).
- **Mock API contract.** `src/lib/api.ts` mirrors the planned FastAPI surface exactly — every function has the same name, signature, and return type as the future real route. Swapping is a one-file change.
- **No real auth.** `src/lib/auth.ts` and `LoginScreen.tsx` are explicitly excluded from refactors. Adding real auth is the next major cut.
- **`App` is the only state owner.** There is no Redux, no Zustand, no Context for app state. Screens communicate via the `useState` ladder in `App.tsx`; persistence goes to localStorage. This is deliberately simple for a hackathon build.
- **External HTTP failures have distinguishable severities.** All 5 HTTP clients (`gemini`, `hf`, `off`, `usda`, `fruityvice`) use `app/services/_http_logging.log_http_failure()`. A 429 emits `ERROR` with a rate-limit hint; a 401/403 emits `ERROR` with a config hint; a 5xx emits `WARNING`; unexpected exceptions use `log.exception`. Operators can tell "flaky network" from "bad API key" without parsing JSON.

## What "cut" we're in

The project ships as **cut (a) contract-only** + **cut (b) real integrations**:

- **Cut (a) (shipped):** FastAPI skeleton, schema lockstep enforced, all routes return 200 with the documented shape. Real persistence (`app/services/state.py`).
- **Cut (b) (shipped):** Real Gemini, real HF, real nutrition cascade (OFF → USDA → Fruityvice), real caches (SQLite TTL + ChromaDB vector), severity-graded logging, request body cap. The mock API on the frontend can be swapped to real `fetch()` calls in `src/lib/api.ts` whenever the backend is reachable from the deployed frontend.

The `cut` field in `app/main.py`'s title and the `root` endpoint surfaces this:
```json
{ "service": "nutrivision-backend", "cut": "a (contract-only skeleton)", "docs": "/docs" }
```
(The string is from the original cut-a commit; the implementation is now
cut-b complete. Cosmetic only.)

## Repo map (top-level only)

```
.
├── README.md                       ← visitor landing page
├── NutriVision_AI_Blueprint.md     ← original design doc (read this)
├── docs/                           ← you are here
├── app/                            ← Python FastAPI backend
├── src/                            ← React + Vite frontend
├── scripts/
│   └── dump-schemas.mjs            ← TS AST walker used by drift test
├── public/                         ← PWA assets (manifest, sw.js, icons)
├── .github/workflows/ci.yml        ← CI: typecheck + tests + build
├── vitest.config.ts                ← vitest config (node env, src/**/*.test.ts)
├── vite.config.ts                  ← Vite build config
├── tsconfig.json                   ← TS strict mode
└── package.json
```

For per-file deep dives, see [frontend/README.md](./frontend/README.md),
[backend/README.md](./backend/README.md), and the per-area component /
service docs.
