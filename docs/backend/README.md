# Backend

FastAPI + Pydantic v2. The contract with the frontend is locked in
`app/models/schemas.py`; the matching TS file (`src/types/schemas.ts`)
is enforced by the schema-drift test. See [schemas.md](../schemas.md).

## Entrypoint

**File:** `app/main.py`

Wires the routers, configures CORS, sets up the state singleton via
the FastAPI lifespan handler.

```python
@asynccontextmanager
async def lifespan(_app: FastAPI):
    path = _state_path()
    init_state(path)
    yield

app = create_app()
```

The app instance is at module level for `uvicorn app.main:app`.

### CORS

Read from `CORS_ALLOW_ORIGINS` env var (comma-separated). Default
keeps local Vite dev working:

```python
def _cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ALLOW_ORIGINS", "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return ["http://localhost:5173", "http://127.0.0.1:5173"]
```

Set this env var in production to allow the deployed frontend
origin. No code change required.

### State path

`_state_path()` resolves `STATE_PATH` (default `app/state.json`)
relative to CWD, walking upward to find the repo root. Works
whether you run uvicorn from the repo root or from `app/`.

## Routers

Mounted under `/api/*`:

| Router | File | Prefix | Tags |
|---|---|---|---|
| Auth | `app/api/auth.py` | `/api/auth` | auth |
| Admin | `app/api/admin.py` | `/api/admin` | admin |
| Vision | `app/api/vision.py` | `/api/vision` | vision |
| Nutrition | `app/api/nutrition.py` | `/api/nutrition` | nutrition |
| Profile | `app/api/profile.py` | `/api/profile` | profile |
| Grocery | `app/api/grocery.py` | `/api/grocery` | grocery |
| Meals | `app/api/meals.py` | `/api/meals` | meals |

See [docs/api/](../api/) for per-route reference.

## Multi-Tenant Persistence & State Store

**File:** `app/services/state.py`

NutriVision AI implements dual-mode persistence with automatic PostgreSQL schema migrations:

1. **PostgreSQL Adapter (`PostgresStore`):**
   - Activated automatically when `DATABASE_URL` is set.
   - Built on `psycopg 3` (`psycopg[binary]`) with connection pooling.
   - Supports Neon pooled connection strings (`-pooler`) and `channel_binding=require`.
   - Explicitly sets `prepare_threshold=None` to ensure 100% compatibility with PgBouncer transaction pooling.
   - Automatically migrates database tables on boot:
     - `nv_users`: Email, name, avatar URL, role, joined date, last active, and `profile_json` (JSONB).
     - `nv_meals`: ID, user email, date, label, photo URL, review status, active goals, and `meal_json` (JSONB).
     - `nv_grocery`: Composite primary key `(user_email, id)`, name, price, and checked state.
2. **Local JSON Fallback:**
   - If `DATABASE_URL` is omitted, persists to a local JSON file (`STATE_PATH`, default `app/state.json`).
3. **Multi-User Isolation:**
   - User data is strictly partitioned by verified email address.
   - Legacy mock and synthetic personas (`judge`, `rafi`, `@nutrivision.ai`) are automatically purged on startup.
   - New users initialize with an empty, zero-state profile without pre-populated meals or fake streak days.

## Caches

### `app/cache/sqlite_cache.py`
TTL exact-match cache. Backed by a local SQLite database
(`SQLITE_CACHE_PATH`, default `app/cache/cache.db`).

```python
cache.put(("vision", image_ref), detections, ttl_s=7 * 24 * 60 * 60)
hits = cache.get(("vision", image_ref))  # list | None
```

Used as a redundant fallback when the vector cache is cold.

### `app/cache/vector_cache.py`
Semantic image cache backed by ChromaDB. On `has(image_ref)` returns
truthy, the vision route short-circuits to the cached detections.

If ChromaDB is not installed or the path is unwritable, the cache
silently no-ops. The route still works — it just always runs the
live pipeline.

## HTTP clients

Five thin wrappers around external APIs. All live in
`app/services/`:

- `gemini_client.py` — Google Gemini 2.0 Flash (primary vision)
- `hf_client.py` — HuggingFace Inference (validator)
- `off_client.py` — Open Food Facts (nutrition)
- `usda_client.py` — USDA FoodData Central (nutrition)
- `fruityvice_client.py` — Fruityvice (fruit-only nutrition)

All five share the same pattern:
- Lazy-instantiated `httpx.Client` (no I/O at import time)
- `close()` method to release the connection pool
- `is_configured()` returns `True` iff the relevant env var is set
- All failures use `log_http_failure()` for severity-graded logging

See [services.md](./services.md) for per-client details.

## The `_http_logging` helper

**File:** `app/services/_http_logging.py`

```python
from app.services._http_logging import log_http_failure

try:
    resp = self._http().get(...)
    resp.raise_for_status()
except (httpx.HTTPError, ValueError) as exc:
    log_http_failure("Gemini", exc, image_ref=image_ref)
    return None
```

Severity rules:
- `429` → `ERROR` with rate-limit hint
- `401/403` → `ERROR` with config hint (check `<PROVIDER>_API_KEY` env var)
- `5xx` → `WARNING` (transient, likely self-healing)
- `4xx` → `WARNING` (bad request shape)
- `httpx.HTTPError` → `WARNING`
- `httpx.ConnectError`, `httpx.ConnectTimeout`, etc. → `WARNING`
- Unexpected → `log.exception` (with stack trace)

This means an operator looking at logs can immediately distinguish
"API is flaky" (WARNING) from "API key is wrong" (ERROR with config
hint).

## Reconcile + portion + trace

Pure functions used by the vision route:

- `app/services/reconcile.py` — `merge(gemini_items, hf_labels)`.
  Confidence-weighted merge of two detection lists.
- `app/services/portion.py` — `estimate(item)`. Bbox-based portion
  estimation. Uses the `DensityEntry` helper table.
- `app/services/trace.py` — `make_trace(stage, label, status)`.
  Convenience constructor for `PipelineTrace`.

## Personalize

**File:** `app/services/personalize.py`

Mirrors `src/lib/personalize.ts`. The flag rules are duplicated
across both files — they're kept in sync by convention, not by a
test. (Adding a CI cross-language test is a candidate for the next
cut.)

The flag rules are:
- sodium > target → red flag with `reason` text
- sugar > target → red flag (or green for diabetic profiles)
- fiber < target → red flag (low is bad)
- protein, carbs, fat — no flag (always within range for the demo)

## Config

### `app/.env.example`

```bash
STATE_PATH=app/state.json
CORS_ALLOW_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
HF_API_TOKEN=

USDA_API_KEY=DEMO_KEY

SQLITE_CACHE_PATH=app/cache/cache.db
VISION_CACHE_TTL=604800
```

Copy this file to `app/.env` and fill in keys as needed. The app
reads env vars at request time, not startup, so you can edit
`.env` and restart uvicorn to pick up changes.

### Programmatic config

For tests, use `app.dependency_overrides` to swap clients. See
`app/tests/test_cascade.py` for the pattern.

## Project structure

```
app/
├── __init__.py
├── main.py                       # FastAPI entrypoint
├── pyproject.toml                # Ruff + mypy config
├── requirements.txt
├── README.md
├── .env.example
├── api/
│   ├── __init__.py
│   ├── vision.py                 # /api/vision/analyze
│   ├── nutrition.py              # /api/nutrition/{targets,resolve,personalize}
│   ├── profile.py                # /api/profile
│   ├── grocery.py                # /api/grocery/*
│   └── meals.py                  # /api/meals/*
├── models/
│   ├── __init__.py
│   └── schemas.py                # Pydantic source of truth
├── services/
│   ├── _http_logging.py          # Severity-graded HTTP failure logger
│   ├── gemini_client.py
│   ├── hf_client.py
│   ├── off_client.py
│   ├── usda_client.py
│   ├── fruityvice_client.py
│   ├── reconcile.py              # Pure function
│   ├── portion.py                # Pure function
│   ├── personalize.py            # Mirrors frontend flag rules
│   ├── targets.py                # Daily kcal target resolver
│   ├── trace.py                  # PipelineTrace helper
│   ├── ocr.py                    # Optional Tesseract wrapper
│   └── state.py                  # JSON-file-backed state singleton
├── cache/
│   ├── sqlite_cache.py           # TTL exact-match
│   └── vector_cache.py           # ChromaDB semantic
├── seed/
│   └── fixtures.py               # DEFAULT_PROFILE, nutrition, grocery seeds
├── data/                         # JSON data files (seed data)
└── tests/
    ├── conftest.py
    ├── test_contract.py          # Pydantic ↔ TS contract tests
    ├── test_cascade.py           # OFF → USDA → Fruityvice cascade
    ├── test_reconcile.py
    ├── test_portion.py
    ├── test_caches.py
    └── test_schema_drift.py      # The drift guard
```

For per-service deep dives, see [services.md](./services.md).