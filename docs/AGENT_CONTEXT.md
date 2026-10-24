# Agent Context

> **You are an AI agent (or a new developer) picking up the NutriVision
> AI codebase.** This file is the 5-minute orientation. Read this
> first, then drill into the linked deep-dives.

## What is this project

A phone-first PWA that uses AI vision to identify foods in a photo,
resolve per-100g nutrition, personalize health flags against a user
profile, and generate a budget-aware grocery list from the user's
meal history.

- **Frontend:** React 18 + Vite + TypeScript PWA in `src/`.
- **Backend:** FastAPI + Pydantic v2 in `app/`.
- **Demo:** <https://cloud-camp-hackathon.vercel.app>
- **Blueprint:** `NutriVision_AI_Blueprint.md` (root) — the original design doc.

The backend has real vision and nutrition integrations, and the
frontend calls those endpoints when `VITE_API_BASE` is configured.
The rest of the app still contains seeded/browser-local demo state;
authentication and durable per-user persistence are not implemented.

## The one thing you MUST understand

**Schema lockstep.** `src/types/schemas.ts` and `app/models/schemas.py`
are the wire-format source of truth for both sides. They must move
together — any change to one without the other is a breaking
integration bug.

This is enforced by a test (`app/tests/test_schema_drift.py`) that:
1. Walks the TS AST via `scripts/dump-schemas.mjs`.
2. Walks the Pydantic model fields.
3. Normalizes (camelCase ↔ snake_case, optional/nullable collapse,
   inline literals vs alias names).
4. Asserts the two maps match.

CI runs this test on every push. See [schemas.md](./schemas.md) for
the full contract and [IMAGE_UPLOAD_FLOW.md](./IMAGE_UPLOAD_FLOW.md)
for an end-to-end trace of one request.

## Don't touch (explicit constraints)

The user has explicitly excluded these from refactors. Do not modify
them unless you have a specific request and have checked the
implications:

- **`src/lib/auth.ts`** — mock auth, will be replaced with real auth
  in the next cut.
- **`src/components/auth/LoginScreen.tsx`** — same.
- **`src/data.ts`** — re-export shim for backward compatibility with
  ~20 call sites. Touching it would touch every screen. The file has
  a top-of-file comment directing new code to import from
  `src/mocks/fixtures.ts` and `src/theme/tokens.ts` directly.
- **`public/sw.js`** — hand-rolled service worker. The cache name
  (`nutrivision-v3`) is documented inline; bump the version when
  shipping breaking changes, not when adding features.

## Repo map (one-line purposes)

### Frontend (`src/`)

| File | Purpose |
|---|---|
| `App.tsx` | App shell: theme provider → auth gate → 5-tab UserApp or AdminLayout |
| `main.tsx` | React root + ErrorBoundary |
| `types/schemas.ts` | **TS source of truth** for the wire format |
| `lib/api.ts` | **Mock API client** — drop-in swap target for real `fetch()` |
| `lib/auth.ts` | Mock auth (don't touch) |
| `lib/format.ts` | Pure helpers (`formatRelative`, `hashStr`, `pickThumbnailStyle`) |
| `lib/personalize.ts` | Flag rules + meal totals (mirrors backend) |
| `lib/storage.ts` | Typed localStorage wrapper |
| `mocks/fixtures.ts` | All `MOCK_*` constants (DB, profile, tabs, targets) |
| `theme/tokens.ts` | Earth-tone design tokens |
| `theme/ThemeContext.tsx` | Light/dark mode provider |
| `data.ts` | **Re-export shim** (don't add new imports here) |
| `components/screens/CaptureScreen.tsx` | Camera + home + meal history (largest screen) |
| `components/screens/ResultsScreen.tsx` | Detected items list, sort/edit/confirm |
| `components/screens/NutrientsScreen.tsx` | Donut charts + flag explainability |
| `components/screens/ProfileScreen.tsx` | Goals, preferences, allergens, budget |
| `components/screens/GroceryScreen.tsx` | Weekly grocery list |
| `components/admin/*` | Admin dashboard (KpiCard, Sparkline, AdminOverview) |
| `components/auth/LoginScreen.tsx` | Mock login (don't touch) |
| `components/Meter.tsx` | MiniBar + MacroMeter (extracted from CaptureScreen) |
| `components/Bar.tsx` | Labeled bar (different from MiniBar) |

See [frontend/components.md](./frontend/components.md) for the full
list with one-paragraph purposes.

### Backend (`app/`)

| File | Purpose |
|---|---|
| `main.py` | FastAPI entrypoint, CORS, lifespan, router wiring |
| `api/vision.py` | `POST /api/vision/analyze` (the headline route) |
| `api/nutrition.py` | `/targets`, `/resolve`, `/personalize` |
| `api/profile.py` | `GET/PUT /api/profile` + admin directory |
| `api/grocery.py` | Grocery list CRUD |
| `api/meals.py` | Meal history + `/today` |
| `models/schemas.py` | **Pydantic source of truth** for the wire format |
| `services/state.py` | JSON-file-backed in-memory state singleton |
| `services/gemini_client.py` | Gemini 2.0 Flash vision client |
| `services/hf_client.py` | HuggingFace validator client |
| `services/off_client.py` | Open Food Facts nutrition client |
| `services/usda_client.py` | USDA FDC nutrition client |
| `services/fruityvice_client.py` | Fruityvice nutrition client |
| `services/reconcile.py` | Confidence-weighted merge (pure) |
| `services/portion.py` | Bbox-based portion estimation (pure) |
| `services/personalize.py` | Flag rules (mirrors frontend) |
| `services/targets.py` | Daily kcal target resolver |
| `services/trace.py` | Pipeline trace helper |
| `services/ocr.py` | Optional Tesseract wrapper |
| `services/_http_logging.py` | Severity-graded HTTP failure logger |
| `cache/sqlite_cache.py` | TTL exact-match cache |
| `cache/vector_cache.py` | ChromaDB exact-ID detection cache |
| `tests/test_schema_drift.py` | **Schema-drift guard** (23 parametrized cases) |
| `tests/test_contract.py` | Pydantic ↔ TS contract tests |
| `tests/test_cascade.py` | OFF → USDA → Fruityvice cascade tests |
| `tests/test_reconcile.py` | Reconcile merge tests |
| `tests/test_portion.py` | Portion estimation tests |
| `tests/test_caches.py` | Cache tests |

### Tooling

| File | Purpose |
|---|---|
| `scripts/dump-schemas.mjs` | Node script — walks `schemas.ts` AST, emits JSON |
| `vitest.config.ts` | vitest config (node env, `src/**/*.test.ts`) |
| `vite.config.ts` | Vite build config |
| `tsconfig.json` | TS strict mode |
| `.github/workflows/ci.yml` | CI: typecheck + tests + build, frontend + backend |

## Common tasks

### "I want to add a new field to a shared type"

1. Edit `src/types/schemas.ts` — add the field to the relevant interface.
2. Edit `app/models/schemas.py` — add the matching field to the matching Pydantic model.
3. Run `cd app && python -m pytest tests/test_schema_drift.py -v` — must pass.
4. If the field needs to flow to/from the frontend mocks, update `src/mocks/fixtures.ts` and the screens that read it.
5. If the field needs a new flag rule, add it to `src/lib/personalize.ts#FLAG_RULES` and `app/services/personalize.py`.

### "I want to add a new route"

1. Pick the right router file under `app/api/`. If none fits, create a new one and register it in `app/main.py`.
2. Define request/response models in `app/api/<file>.py` (using `app.models.schemas` types where possible — don't redefine).
3. Add a Pydantic `BaseModel` for the request body if it's not a primitive.
4. Add the frontend API call and only add a local demo fallback if that behavior is intentional.
5. Add a test in `app/tests/test_contract.py` or a new file.

### "I want to wire a frontend operation to the backend"

1. Inspect the matching route in `app/api/` and schema in both language trees.
2. Follow the existing `apiFetch` pattern in `src/lib/api.ts`, including clear handling for non-2xx responses.
3. Confirm Vercel's `VITE_API_BASE` and backend CORS configuration are set for deployment.
4. Add/adjust contract tests and run frontend and backend checks.

### "I want to add a new tab to the bottom nav"

1. Edit `src/mocks/fixtures.ts` — add a new entry to `MOCK_TABS`.
2. If the tab needs a screen, add a new file under `src/components/screens/`.
3. Register the screen in `src/App.tsx#UserApp`'s switch.
4. The `TAB_GROCERY` lookup in `CaptureScreen.tsx` already uses `findIndex` so it's resilient to reordering.

### "I want to add a new external API client"

1. Create `app/services/<name>_client.py`.
2. Mirror the pattern of `off_client.py` or `usda_client.py`:
   - `httpx.Client` lazy-instantiated
   - `lookup(name) -> NutritionFacts | None` (or your return type)
   - `close()` method
   - Severity-graded `log_http_failure()` calls
3. Wire it into the appropriate cascade in `app/api/nutrition.py`.
4. If the API is keyed, add the env var to `app/.env.example`.

### "I want to add a frontend test"

1. Find a pure function in `src/lib/` (no DOM, no React, no fetch).
2. Create `src/lib/<file>.test.ts` (the `vitest.config.ts` glob picks it up).
3. Use Vitest's `describe` / `it` / `expect`. No `@testing-library`, no `jsdom` — we test pure helpers only.
4. Run `npm test`.

### "I want to add a backend test"

1. Use `pytest` with the fixtures from `app/tests/conftest.py`.
2. For HTTP route tests, use FastAPI's `TestClient` against `app.main:app`.
3. For pure functions (reconcile, portion, etc.), call the function directly.
4. For external HTTP, mock with `respx`; use `app/seed/fixtures.py` only for seeded domain data.
5. Run `cd app && python -m pytest tests/ -q`.

## Test commands

```bash
# Frontend
npm test              # vitest run (one-shot, exits after)
npm run test:watch    # vitest (interactive)
npm run typecheck     # tsc --noEmit
npm run build         # production build

# Backend
cd app
python -m pytest tests/ -q                       # all tests
python -m pytest tests/test_schema_drift.py -v   # schema-drift guard only
ruff check .                                       # lint
```

All of the above pass today (66 backend, 23 drift, 21 frontend).

## Environment variables

### Backend (`app/.env.example`)

| Var | Default | Purpose |
|---|---|---|
| `STATE_PATH` | `app/state.json` | JSON file backing the state singleton |
| `CORS_ALLOW_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated CORS allow-list |
| `GEMINI_API_KEY` | (unset) | Enables Gemini vision. If both provider keys are unset, analysis returns HTTP 503. |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Model name |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/models` | Override for testing |
| `HF_API_TOKEN` | (unset) | Enables HF validator |
| `OFF_BASE_URL` | (unset) | Open Food Facts override |
| `USDA_BASE_URL` | (unset) | USDA FDC override |
| `USDA_API_KEY` | `DEMO_KEY` | USDA key |
| `FRUITYVICE_BASE_URL` | (unset) | Fruityvice override |
| `SQLITE_CACHE_PATH` | `app/cache/cache.db` | SQLite TTL cache path |
| `VISION_CACHE_TTL` | `604800` (7 days) | Vector cache TTL in seconds |

## Working conventions

- **No new state-management libraries.** Screens share state via
  `useState` ladders in `App.tsx`; persistence goes to localStorage
  or the backend.
- **Pure functions in `src/lib/` get unit tests.** Components do
  not (no jsdom, no testing-library).
- **HTTP clients use `log_http_failure()`.** Do not call `log.warning`
  directly from a client — the helper grades severity.
- **Schema types are referenced, not redefined.** Don't duplicate
  `NutritionFacts` or `DetectedItem` in a screen file — import from
  `src/types/schemas`.
- **Tab indices are computed.** `TAB_GROCERY` in `CaptureScreen` is
  derived from `MOCK_TABS.findIndex` so reordering tabs in
  `mocks/fixtures.ts` doesn't silently break navigation.

## Where to ask for help

- The blueprint (`NutriVision_AI_Blueprint.md`) has the original
  design intent.
- This `docs/` folder is the current source of truth.
- GitHub Issues are not enabled for this hackathon repo; ask the
  user directly.
