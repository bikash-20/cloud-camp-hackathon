# NutriVision AI backend — cut (a)

Lean FastAPI skeleton that mirrors the frontend's mock API surface
(`src/lib/api.ts`). The shape is locked; the internals are stubs that
return canned data or look up via Open Food Facts (no API key needed).

This ships in **cut (a)** only — real Gemini / HF / USDA integration
lands in cut (b). See `NutriVision_AI_Blueprint.md` at the repo root
for the full picture.

## What this is

A runnable `uvicorn` server that exposes every endpoint the frontend
already consumes, returning the exact Pydantic mirror of the
TypeScript interfaces in `src/types/schemas.ts`.

## What this is **not**

- Not a deployed service. It runs locally only.
- Not a real vision pipeline. Vision returns canned detections keyed
  off `image_ref` strings (`"chicken_biryani.jpg"` is the only seeded
  ref).
- Not a full nutrition cascade. OFF is the only live source; USDA and
  Fruityvice slots are stubbed for cut (b).
- Not connected to the deployed Vercel demo. The frontend keeps using
  mocks until you explicitly wire it (see "Swapping mocks for the
  backend" below).

## Quick start

```bash
cd nutrivision-demo/app
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open <http://localhost:8000/docs> for the auto-generated Swagger UI.

### Try it from curl

```bash
curl -s http://localhost:8000/api/profile | jq .
curl -s 'http://localhost:8000/api/grocery?budget=500' | jq '.groups[].category'
curl -s -X POST http://localhost:8000/api/vision/analyze \
  -H 'Content-Type: application/json' \
  -d '{"image_ref":"chicken_biryani.jpg"}' | jq '.detected[].name'
```

### Run the contract tests

```bash
cd nutrivision-demo
PYTHONPATH=app python3 -m pytest app/tests/ -v
```

16 tests cover every endpoint round-trip + the three negative paths
documented in the cut-(a) plan.

## Layout

```
app/
├── main.py                  FastAPI app, CORS, lifespan, router wiring
├── models/schemas.py        Pydantic v2 — 1:1 with src/types/schemas.ts
├── seed/fixtures.py         Server-side mirror of MOCK_DETECTED, etc.
├── services/
│   ├── state.py             JSON-file-backed in-memory store
│   ├── off_client.py        Open Food Facts HTTP client
│   ├── ocr.py               Optional Tesseract wrapper (off by default)
│   ├── trace.py             PipelineTrace helpers
│   └── targets.py           resolve_daily_kcal_target()
├── api/
│   ├── vision.py            POST /api/vision/analyze
│   ├── nutrition.py         POST /api/nutrition/resolve, GET /api/nutrition/targets
│   ├── profile.py           GET/PUT /api/profile
│   ├── grocery.py           CRUD on /api/grocery and /api/grocery/items
│   ├── meals.py             CRUD on /api/meals + /api/meals/today + /api/meals/stats
│   └── personalize.py       SHAP-style contribution computation
├── tests/
│   ├── conftest.py          TestClient + isolated state + OFF stub
│   └── test_contract.py     16 contract tests
├── requirements.txt         fastapi, uvicorn, pydantic, httpx, pytest, ruff
├── pyproject.toml           ruff + pytest config
├── .env.example             Documents STATE_PATH, OFF_BASE_URL, OCR_ENABLED
└── state.json               (created on first run; gitignored)
```

## Endpoint map

Every endpoint mirrors a function exported from `src/lib/api.ts`:

| Frontend export | HTTP route | Method |
|---|---|---|
| `analyzeMeal(imageRef)` | `/api/vision/analyze` | POST |
| `resolveNutrition(items, profile?)` | `/api/nutrition/resolve` | POST |
| `getMacroTargets()` | `/api/nutrition/targets` | GET |
| `getProfile()` | `/api/profile` | GET |
| `updateProfile(p)` | `/api/profile` | PUT |
| `getGroceryList(profile)` | `/api/grocery?budget=…` | GET |
| `addGroceryItem(cat, name, price)` | `/api/grocery/items` | POST |
| `removeGroceryItem(id)` | `/api/grocery/items/{id}` | DELETE |
| `updateGroceryPrice(id, price)` | `/api/grocery/items/{id}/price` | PUT |
| `toggleGroceryItem(id)` | `/api/grocery/items/{id}/toggle` | POST |
| `clearGroceryList()` | `/api/grocery` | DELETE |
| `saveMeal(entry)` | `/api/meals` | POST |
| `getMealHistory()` | `/api/meals` | GET |
| `deleteMeal(id)` | `/api/meals/{id}` | DELETE |
| `getTodaySummary()` | `/api/meals/today` | GET |
| `getUserStats()` | `/api/meals/stats` | GET |
| `login` / `logout` / `getSession` | _not implemented_ | — |

Auth stays mock-grade in the frontend for cut (a) — see `src/lib/auth.ts`.

## State persistence

`app/services/state.py` reads/writes `app/state.json` (path configurable
via `STATE_PATH`). On first boot the file is seeded with the same
profile, grocery list, and empty meal history as the frontend's
`MOCK_PROFILE` / `DEFAULT_GROCERY_GROUPS`. Every mutation rewrites the
file. This is intentionally not a database — cut (b) swaps in SQLite.

## Schema lockstep rule

`app/models/schemas.py` is the source of truth on the backend side;
`src/types/schemas.ts` mirrors it on the frontend side. Any change to
a field name, type, or required-vs-optional flag requires both files
to update in the same commit. The contract tests in
`app/tests/test_contract.py` exist to catch drift the moment a
schema changes — if you rename a field on one side, pytest will fail.

## Swapping mocks for the backend (cut b)

When you want to point the frontend at this skeleton:

1. Start the server locally on port 8000.
2. In `src/lib/api.ts`, change every `await delay(...)` + mock body
   to a real `fetch('/api/...')` call.
3. The frontend already lives at `http://localhost:5173` (Vite) — CORS
   is pre-wired for that origin in `app/main.py`.

The deployed Vercel demo continues to ship the frontend-only build —
it does **not** talk to this skeleton. That's deliberate; demos
shouldn't depend on locally-running infrastructure.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `STATE_PATH` | `app/state.json` | JSON file backing the state store. Relative paths resolve against the repo root when running from anywhere. |
| `OFF_BASE_URL` | `https://world.openfoodfacts.org` | Open Food Facts base URL. Free, no key required. |
| `OCR_ENABLED` | `false` | Set to `true` to enable Tesseract OCR fallback (requires `pip install pytesseract` AND the Tesseract binary on PATH). |
| `GEMINI_API_KEY` | — | Cut (b). |
| `HF_API_TOKEN` | — | Cut (b). |
| `USDA_API_KEY` | — | Cut (b). |

See `.env.example` for a copy-paste template.

## What's next

- **Cut (b):** real Gemini vision, HF validator, USDA cascade.
  No contract changes — only the internals of `api/vision.py` and
  `api/nutrition.py` change.
- **Cut (c):** SQLite response cache, ChromaDB semantic cache, real
  portion estimation, Firebase auth. Still no contract changes.
