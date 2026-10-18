# NutriVision AI — Documentation

This folder is the comprehensive guide to the NutriVision AI codebase.
If you're a new developer, an AI agent, or a curious onlooker, start
here.

## Quick links

| If you want to… | Read |
|---|---|
| Understand the whole system in 5 minutes | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Trace what happens when a user uploads a picture | [IMAGE_UPLOAD_FLOW.md](./IMAGE_UPLOAD_FLOW.md) |
| Pick up this codebase as an AI agent | [AGENT_CONTEXT.md](./AGENT_CONTEXT.md) |
| Set up the project locally and run tests | [development.md](./development.md) |
| Deploy the frontend to Vercel + backend to Railway | [deployment.md](./deployment.md) |
| See what was changed in the recent cleanup | [CHANGELOG.md](./CHANGELOG.md) |
| Add or modify a shared type | [schemas.md](./schemas.md) |

## Per-area deep dives

### Frontend (`src/`)

- [frontend/README.md](./frontend/README.md) — app shell, state, mock API, theme system
- [frontend/components.md](./frontend/components.md) — every component, grouped

### Backend (`app/`)

- [backend/README.md](./backend/README.md) — entrypoint, routers, caches, HTTP clients
- [backend/services.md](./backend/services.md) — every service module, one paragraph each

### HTTP API

- [api/vision.md](./api/vision.md) — `POST /api/vision/analyze`
- [api/nutrition.md](./api/nutrition.md) — targets, resolve, personalize
- [api/profile.md](./api/profile.md) — get/update profile, admin directory
- [api/grocery.md](./api/grocery.md) — grocery list CRUD + generate-from-meals
- [api/meals.md](./api/meals.md) — meal history + today's summary

## Source-of-truth files

These are the files you must read before changing anything:

- `NutriVision_AI_Blueprint.md` (repo root) — the original design doc
- `src/types/schemas.ts` — frontend wire-format source of truth
- `app/models/schemas.py` — backend wire-format source of truth
- `app/tests/test_schema_drift.py` — enforces the two stay in sync
- `scripts/dump-schemas.mjs` — TS AST walker used by the drift test

## Repo conventions

- **No Redux, no React Query.** State lives in `localStorage` + per-screen `useState`.
- **Schema lockstep.** Any change to `src/types/schemas.ts` requires a matching change to `app/models/schemas.py`, and vice versa. The drift test in CI will fail otherwise.
- **Auth is mock-grade.** `src/lib/auth.ts` and `src/components/auth/LoginScreen.tsx` are explicitly out of scope for refactors. Real auth is the next cut.
- **HTTP clients share a logging helper.** `app/services/_http_logging.log_http_failure()` grades severity by exception class so an operator can tell "API is flaky" from "API key is wrong" at a glance.

## Recent test surface

- Frontend: 21 vitest tests across 2 files (`src/lib/format.test.ts`, `src/lib/personalize.test.ts`).
- Backend: 66 pytest tests across 6 files, plus a 23-case parametrized schema-drift guard.
- CI: `.github/workflows/ci.yml` runs both halves on every push and PR.

See [development.md](./development.md) for the exact commands.