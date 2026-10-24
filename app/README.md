# NutriVision AI backend

FastAPI backend for the frontend API in `src/lib/api.ts`. It can call
Gemini for meal-photo detection and Hugging Face for optional label
validation when server-side credentials are configured. Without those
credentials, vision uses seeded examples for known fixture names and
returns no detections for unknown image references.

## What this is

A runnable `uvicorn` server that exposes every endpoint the frontend
already consumes, returning the exact Pydantic mirror of the
TypeScript interfaces in `src/types/schemas.ts`.

## What this is **not**

- Not deployed by this repository. You must deploy this FastAPI service
  separately and configure the frontend to use its HTTPS URL.
- Not production-ready persistence or authentication. Profile, grocery,
  and meal state is JSON-file-backed; frontend demo authentication is
  client-side.
- Not guaranteed to identify every dish. Gemini may return uncertain or
  empty results; review detections before relying on nutrition estimates.

## Quick start

From the repository root, install `app/requirements.txt`, set
`GEMINI_API_KEY` in the server process environment, and start:

```bash
uvicorn app.main:app --reload --port 8000
```

Keep the Gemini key only in the backend host's secret settings (or a
local, gitignored environment file). Never put it in a `VITE_*` variable
or frontend code. For the deployed Vercel frontend, set
`VITE_API_BASE` to the deployed backend's HTTPS origin and set
`CORS_ALLOW_ORIGINS` on the backend to include the Vercel site origin.

Open <http://localhost:8000/docs> for the auto-generated Swagger UI.

### Deploy the backend to Render

The existing Render web service is connected to this repository's `main`
branch and auto-deploys on commits. Its root directory must be the
repository root (`.`), with build command
`pip install -r app/requirements.txt`, start command
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`, and health check
`/health`.

In Render's Environment settings, set `GEMINI_API_KEY` to a newly
rotated key and `CORS_ALLOW_ORIGINS` to
`https://cloud-camp-hackathon.vercel.app`. Never put the Gemini key in
GitHub or Vercel. After the backend is healthy, set Vercel's
`VITE_API_BASE` to `https://cloud-camp-hackathon.onrender.com` and
redeploy the frontend.

The free service uses an ephemeral filesystem and may sleep while idle.
Do not rely on the backend's local JSON state or caches as durable
production storage.

### Try it from curl

```bash
curl -s http://localhost:8000/api/profile | jq .
curl -s 'http://localhost:8000/api/grocery?budget=500' | jq '.groups[].category'
curl -s -X POST http://localhost:8000/api/vision/analyze \
  -H 'Content-Type: application/json' \
  -d '{"image_ref":"chicken_biryani.jpg"}' | jq '.detected[].name'
```

### Run the contract tests

From the repository root, after installing `app/requirements.txt`:

```bash
python -m pytest app/tests/ -v
```

The backend suite covers endpoint contracts, cache behavior, provider
request construction, and failure paths. Provider tests use mocked HTTP
responses and do not call Gemini or Hugging Face.

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

## Connecting the frontend to the backend

When you want to point the frontend at this skeleton:

1. Run the backend locally on port 8000.
2. Set `VITE_API_BASE=http://localhost:8000` in the frontend's local
   Vite environment and restart the dev server.
3. The backend's default CORS list allows `http://localhost:5173` and
   `http://127.0.0.1:5173`. Set `CORS_ALLOW_ORIGINS` for other origins.
4. For production, configure the Vercel `VITE_API_BASE` at build time
   and deploy the backend separately with its own secrets and CORS
   allow-list. Vercel does not host this Python API automatically.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `STATE_PATH` | `app/state.json` | JSON file backing the state store. Relative paths resolve against the repo root when running from anywhere. |
| `OFF_BASE_URL` | `https://world.openfoodfacts.org` | Open Food Facts base URL. Free, no key required. |
| `OCR_ENABLED` | `false` | Set to `true` to enable Tesseract OCR fallback (requires `pip install pytesseract` AND the Tesseract binary on PATH). |
| `GEMINI_API_KEY` | — | Enables Gemini photo detection. Backend secret only. |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model name. |
| `HF_API_TOKEN` | — | Enables optional Hugging Face validation. |
| `USDA_API_KEY` | `DEMO_KEY` | USDA FoodData Central nutrition lookup. |

See `.env.example` for a copy-paste template.

## What's next

- Replace JSON-file demo state with durable database storage and add
  server-side user authentication before production use.
