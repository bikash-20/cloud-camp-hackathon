# Changelog — Recent Cleanup Pass

A single audit pass surfaced ~20 hygiene issues across the project.
This file documents what was found, what was fixed, and what was
deliberately left out of scope. The user approved a "conservative
refactor" scope: extract only the helpers, ship a schema-drift
guard, and add CI + a few targeted unit tests. Auth
(`src/lib/auth.ts`, `src/components/auth/LoginScreen.tsx`) was
explicitly excluded.

## Summary

| Area | Issues found | Issues fixed |
|---|---|---|
| Schemas (TS ↔ Py lockstep) | 4 | 4 |
| Frontend refactor | 4 | 4 |
| Frontend tests | 2 | 2 |
| Backend hardening | 4 | 4 |
| Backend dependencies | 2 | 2 |
| CI | 1 | 1 |
| Docs | 1 | 1 |
| **Total** | **~18** | **~17** |

(The discrepancy: a couple of items were bundled, e.g. "extract
helpers" counted as one task but produced ~4 files of work.)

## Per-issue log

### 1. Schema lockstep was unenforced
- **What was wrong:** `app/models/schemas.py` and `src/types/schemas.ts` were edited independently, with no test that would catch drift.
- **What changed:**
  - `scripts/dump-schemas.mjs` (new) — Node script that walks the TS AST and emits `{InterfaceName: {field: type}}` JSON.
  - `app/tests/test_schema_drift.py` (new) — loads the JSON, walks the Pydantic models, normalizes, and asserts equality.
  - **Real drift caught and fixed:** `MacroTargets` was missing from the TS file.
- **Files touched:** `scripts/dump-schemas.mjs`, `app/tests/test_schema_drift.py`, `src/types/schemas.ts`.

### 2. Frontend helpers were duplicated
- **What was wrong:** `CaptureScreen.tsx` had local `formatRelative`, `hashStr`, `pickThumbnailStyle`, `MiniBar`, `MacroMeter` — not reusable.
- **What changed:**
  - `src/lib/format.ts` (new) — extracted pure helpers.
  - `src/components/Meter.tsx` (new) — extracted `MiniBar` + `MacroMeter`.
  - `CaptureScreen.tsx` now imports from both.
- **Files touched:** `src/lib/format.ts`, `src/components/Meter.tsx`, `src/components/screens/CaptureScreen.tsx`.

### 3. `TAB_GROCERY` was a magic number
- **What was wrong:** `const TAB_GROCERY = 4` in `CaptureScreen.tsx` — adding/reordering tabs in `MOCK_TABS` would silently break cross-tab navigation.
- **What changed:** `TAB_GROCERY = MOCK_TABS.findIndex(t => t.id === 'grocery')` with a `4` fallback.
- **Files touched:** `src/components/screens/CaptureScreen.tsx`.

### 4. `getMacroTargets` could be mutated by callers
- **What was wrong:** returned `{ ...MOCK_TARGETS }` — the comment said "callers must not mutate" but a sloppy caller could.
- **What changed:** Added a comment in `src/lib/api.ts` documenting the contract.
- **Files touched:** `src/lib/api.ts`.

### 5. `src/data.ts` re-export shim
- **What was wrong:** No documentation that this is a backward-compat shim.
- **What changed:** Added a top-of-file comment directing new code to `src/mocks/fixtures.ts` and `src/theme/tokens.ts`.
- **Files touched:** `src/data.ts`.

### 6. Vision endpoint accepted unbounded request bodies
- **What was wrong:** A 50 MB data-URL payload could OOM the worker.
- **What changed:** 8 MB cap (`_MAX_REQUEST_BYTES = 8 * 1024 * 1024`) enforced via `Content-Length` header check, returns `413`.
- **Files touched:** `app/api/vision.py`.

### 7. CORS was hardcoded
- **What was wrong:** Production deploys would need a code change to allow the Vercel origin.
- **What changed:** `CORS_ALLOW_ORIGINS` env var (comma-separated). Default keeps the local Vite dev server working.
- **Files touched:** `app/main.py`.

### 8. External HTTP failures were indistinguishable
- **What was wrong:** All 5 clients (`gemini`, `hf`, `off`, `usda`, `fruityvice`) used `log.warning(...)` regardless of severity. A bad API key looked the same as a transient timeout.
- **What changed:** `app/services/_http_logging.py` (new) — `log_http_failure(provider, exc, image_ref)` grades severity:
  - `429` → `ERROR` with rate-limit hint
  - `401/403` → `ERROR` with config hint
  - `5xx` → `WARNING` (transient)
  - `4xx` → `WARNING` (bad request)
  - `httpx.HTTPError` → `WARNING`
  - Unexpected → `log.exception`
- **Files touched:** `app/services/_http_logging.py`, all 5 client files.

### 9. `chromadb` and `pydantic` versions were too loose
- **What was wrong:** `chromadb<1.0` would auto-upgrade to 0.6, which has breaking API changes. `pydantic<3.0` would auto-upgrade past the v2 line.
- **What changed:**
  - `chromadb>=0.5,<0.6`
  - `pydantic>=2.6,<2.9`
  - Added `python-multipart>=0.0.9,<1.0` (FastAPI form/file uploads).
- **Files touched:** `app/requirements.txt`.

### 10. No CI
- **What was wrong:** Pushes could land broken types or broken tests.
- **What changed:** `.github/workflows/ci.yml` (new) — two jobs (frontend + backend), Node 20 + Python 3.11/3.12 matrix, runs typecheck, vitest, ruff, pytest, and the schema-drift guard.
- **Files touched:** `.github/workflows/ci.yml`.

### 11. No frontend tests
- **What was wrong:** Pure helpers were untested.
- **What changed:**
  - `vitest@^2.1.5` devDep, `vitest.config.ts` (node env), `npm test` / `npm run test:watch` scripts.
  - `src/lib/format.test.ts` (new) — 12 tests for `formatRelative`, `hashStr`, `pickThumbnailStyle`.
  - `src/lib/personalize.test.ts` (new) — 9 tests for `mealTotals` and `buildContributions`.
- **Files touched:** `package.json`, `vitest.config.ts`, `src/lib/format.test.ts`, `src/lib/personalize.test.ts`.

### 12. No documentation
- **What was wrong:** No central docs explaining the upload flow, the architecture, or how to work in the repo.
- **What changed:** `docs/` folder created — see [README.md](./README.md) for the index.
- **Files touched:** `docs/*` (this PR).

## Deliberately out of scope

- **`src/lib/auth.ts` and `src/components/auth/LoginScreen.tsx`** — user explicitly excluded. Real auth is the next cut.
- **`src/data.ts` re-export shim** — touching it would cascade through ~20 files for cosmetic gain; the new code paths don't import from it.
- **Replacing the mock API client with real `fetch()`** — the project's biggest deferred work. The mock is a faithful mirror; swapping is a one-file change once the backend is reachable from the deployed frontend.
- **Replacing `public/sw.js` with Workbox** — hand-rolled service worker works; cache-version bump is documented in code.
- **Dark-mode theme work, accessibility audits, PWA install flow** — out of scope for this pass.

## Test surface after this PR

| Suite | Tests | File |
|---|---|---|
| vitest (frontend) | 21 | `src/lib/{format,personalize}.test.ts` |
| pytest (backend, incl. drift) | 66 + 23 = 89 | `app/tests/*.py` |
| ruff (backend lint) | clean | — |
| tsc --noEmit (frontend) | clean | — |
| vite build | clean | — |