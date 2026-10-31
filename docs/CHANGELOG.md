# Changelog

## [Production Release] Persona-Aware Dual-Voice Speech Cascade, Edge-TTS Fallback & Vercel Edge Proxy

This release upgrades NutriVision AI's speech engine into an enterprise-grade 3-tier synthesis pipeline featuring persona-aware voice routing, automated ElevenLabs Free-Tier 402 error protection, server-side neural speech fallback via `edge-tts`, on-demand `🔊 Listen` button playback, and transparent Vercel edge proxying.

### 1. Persona-Aware Dual-Voice Routing (`tts_service.py` & `CoachScreen.tsx`)
- **🔬 Dr. Susmit (Scientist / Male):** Voiced by ElevenLabs premade voice `JBFqnCBsd6RMkjVDRZzb` (George). Overridable via `ELEVENLABS_VOICE_ID_MALE`.
- **🧠 Farhana Ahmed (Habit Coach / Female):** Voiced by ElevenLabs premade voice `EXAVITQu4vr4xnSDxMaL` (Sarah). Overridable via `ELEVENLABS_VOICE_ID_FEMALE`.
- **Persona Context Propagation:** `persona` is passed in both `/api/coach/voice-chat` and `/api/coach/tts` payloads and incorporated into client audio cache keys.

### 2. Free-Tier Premade Voice Selection & HTTP 402 Protection
- **Legacy Library Voice Shield:** ElevenLabs now restricts Free Tier keys from using library voices (e.g., `21m00Tcm4TlvDq8ikWAM` / Rachel), throwing HTTP 402 `Free users cannot use library voices`. `resolve_voice_id()` strictly ignores legacy IDs and defaults to guaranteed premade voices.
- **In-Flight Error Recovery:** Automatically catches HTTP 400 (`voice_not_found`) and HTTP 402 errors from ElevenLabs, immediately retrying synthesis with the default premade voice before degrading.

### 3. Server-Side Neural TTS Fallback (`edge-tts` / Zero-Key)
- Added `edge-tts` to `requirements.txt`.
- When ElevenLabs is unconfigured, rate-limited, or fails, the server synthesizes crystal-clear neural MP3 audio via Microsoft Azure Speech endpoints with **zero API key requirement**.
- **Gender & Language Matched:**
  - Dr. Susmit: `en-US-AndrewNeural` (EN) / `bn-BD-PradeepNeural` (BN)
  - Farhana: `en-US-AvaNeural` (EN) / `bn-BD-NabanitaNeural` (BN)
- Executed inside an isolated thread event loop (`_run_async_in_thread`) to prevent blocking or conflicting with uvicorn's main loop.

### 4. On-Demand `🔊 Listen` Button & Audio Observability
- Added `POST /api/coach/tts` endpoint allowing users to trigger speech synthesis on any message bubble on demand.
- Frontend message-level audio caching (`audioCacheRef`) prevents redundant network requests for already synthesized messages.
- Added `tts_diagnostic` field to `CoachChatResponse` and `CoachTTSResponse` detailing the exact provider and voice used (e.g., `elevenlabs_flash_v2_5`, `edge_tts_fallback:en-US-AndrewNeural`, `browser_tts_client`).

### 5. Transparent Vercel Edge Proxy
- Added `/api/:path*` rewrite in `vercel.json` pointing to `https://cloud-camp-hackathon.onrender.com/api/:path*`.
- Relative API requests from the frontend resolve cleanly to the Render backend, preventing SPA 404 router traps and eliminating unnecessary CORS preflight delays.

### 6. Test Suite Expansion
- 178 Pytest backend unit, coach, RAG, and TTS tests passing (`python3 -m pytest app/tests/ -v`).
- 74 Vitest frontend unit tests passing (`npm test -- --run`).
- 0 TypeScript type errors under strict checking (`npm run typecheck`).

---

## [Production Release] Multi-Agent Voice AI Assistant, Dynamic ElevenLabs TTS & Live Database Grounding

This release introduces conversational voice intelligence to NutriVision AI, with real-time speech synthesis, live PostgreSQL grounding (`nv_users`, `nv_meals`, `nv_grocery`), fail-loud storage architecture, and high-contrast dark theme refinements.

### 1. Multi-Agent Voice AI Assistant (`CoachScreen.tsx` & `/api/coach/*`)
- **Single-Pass Dual-Channel Response:** Delivers a complete clinical Markdown response alongside an ultra-concise spoken summary (`voice_summary`, <60 words, clean of Markdown, LaTeX, and emojis) via `===VOICE_SUMMARY===` in a single LLM pass.
- **Dual Personas:**
  - **Dr. Susmit (পুষ্টি বিজ্ঞানী / Nutrition Biochemist):** Evidence-based biochemical analysis of glycemic load ($GL$), cooking oil absorption, and clinical macronutrient partitioning per BIRDEM/ADA guidelines.
  - **Farhana Ahmed (আচরণ ও অভ্যাস কোচ / Habit Coach):** Empathetic behavioral coaching based on CBT habit science, lifestyle pacing, and guilt-free dawat/feast recovery.
- **Live Database Grounding:** Dynamically injects the user's clinical profile, today's logged meals and remaining intake budget, and active pantry items (`nv_grocery`) from PostgreSQL. Null-safe fallbacks prevent errors when logs or pantries are empty.
- **Hands-Free Speech-to-Text (STT):** Microphone integration with a dedicated `[বাং / EN]` toggle pill enabling instant switching between `bn-BD` and `en-US` speech recognition on the fly.

### 2. Low-Latency ElevenLabs TTS Engine (`tts_service.py`)
- **Dynamic Language-Aware Model Routing:**
  - **English:** Uses `eleven_flash_v2_5` for ultra-low ~75ms TTFA latency and halved character consumption.
  - **Bengali:** Automatically detects Bengali Unicode script (`\u0980-\u09FF`) or `lang="bn"` and routes to `eleven_multilingual_v2` for authentic native phonetics.
- **In-Memory Thread-Safe LRU Cache:** 128-entry cache eliminates latency and character quota for repeated greetings and phrases.
- **Zero-Crash Graceful Degradation:** If `ELEVENLABS_API_KEY` is unset, rate-limited, or times out, returns `use_browser_tts: true` with `audio_base64: null`. Never fails with a 500 error; frontend falls back seamlessly to `window.speechSynthesis`.

### 3. Fail-Loud Storage Backend & Health Probe (`/api/health`)
- Logs explicit storage status on startup: `"Storage backend: postgres (host=...)"` or `"Storage backend: json file"`.
- Never silently falls back to JSON when `DATABASE_URL` is set; refuses startup or returns 503 on database migration errors.
- Added public monitoring endpoint `GET /api/health` reporting storage backend type and database connectivity without exposing credentials.
- Added tracked migration table `nv_migrations` ensuring legacy demo cleanup runs once and preserves real user accounts.

### 4. UI Contrast & Theme Fixes
- Enforced Light Mode as the explicit default across `ThemeContext.tsx` and `index.html`.
- Fixed chart container in `RevenueCurveChart.tsx` so it adapts to dark mode (`rgba(42, 32, 27, 0.94)`) instead of glaring stark white.
- Redesigned Profile screen dark-on-dark contrast for titles, subtitles, user stats cards, and stepper inputs (`StepperRow`).
- Fixed Nutrients screen empty meal state banner and heading contrast.

### 5. Test Suite Expansion
- 171 Pytest backend unit and integration tests passing (`python3 -m pytest app/tests/ -v`).
- 74 Vitest frontend unit tests passing (`npm test -- --run`).
- 0 TypeScript compilation errors under strict mode (`npm run typecheck`).

---

## [Production Release] Real Google OAuth 2.0, PostgreSQL Multi-Tenancy & Dynamic Admin Intelligence

This major release upgrades NutriVision AI from a prototype with local/demo fixtures to a production-ready, multi-tenant system backed by real Google authentication and managed PostgreSQL storage.

### 1. Real Google OAuth 2.0 Authentication
- Replaced mock login buttons with official **Google Identity Services (GIS)** ID-token flow.
- Backend verifies Google ID tokens cryptographically against Google's public JWKS endpoints (`POST /api/auth/google`).
- Issues signed HMAC-SHA256 session JWTs attached via `Authorization: Bearer <token>`.
- Admin privileges granted dynamically based on `ADMIN_EMAILS` environment configuration.
- Completely removed all fake demo buttons, judge accounts, and hardcoded fallbacks.

### 2. Dual-Mode PostgreSQL Persistence (`app/services/state.py`)
- Dynamic PostgreSQL persistence via `psycopg 3` (`psycopg[binary]>=3.1,<4.0`), activated by `DATABASE_URL`.
- Auto-runs DDL migrations on startup for `nv_users`, `nv_meals`, and `nv_grocery`.
- Fully optimized for **Neon Serverless Postgres** pooled endpoints (`-pooler`) and PgBouncer by disabling server-side prepared statements (`prepare_threshold=None`).
- Supports strict TLS channel binding (`channel_binding=require` with `SCRAM-SHA-256-PLUS`).
- Multi-user tenant isolation: each user's profile, meals, and grocery records are strictly keyed to their verified Google email.
- Automatic startup purge removes legacy synthetic demo accounts (`judge`, `rafi`, `@nutrivision.ai`).

### 3. Dynamic 4-View Admin Intelligence Portal
- **Overview:** Live platform metrics (`totalRegisteredUsers`, `newUsersToday`, `activeUsers7d`, `mealsToday`, `mealsThisWeek`), auto-refreshing every 30 seconds with manual Refresh control. Real flagged meal ratio with dynamic meal count denominator.
- **Sparkline:** Rebuilt with responsive flexbox bars and crisp HTML weekday labels (`dayLabel`, Bengali font support), eliminating squashed SVG text.
- **Users Directory:** Searchable and sortable table of all registered users with avatars, joined dates, streak days, and slide-over user inspection modal.
- **Popular Foods View:** Ranked food item frequencies with date-range filters (`Today`, `7 Days`, `30 Days`, `All Time`), share percentage progress bars, and average confidence badges.
- **Review Queue View:** Flagged low-confidence (<70%) meals table with photo preview, confidence score chips, and modal actions for Approve, Correct food label, and Dismiss.

### 4. Zero-Flash Theme Engine & WCAG AA Styling
- Synchronous inline script in `<head>` of `index.html` checks stored theme preference or OS dark-mode setting before DOM render, completely eliminating white theme flash on load.
- Enforced WCAG AA contrast for dark mode across all admin views, modals, forms, dropdowns, inputs, language switches, and coach chat bubbles.

### 5. Clean User Onboarding
- New Google users begin with a clean zero-state profile (name and avatar from Google, 0 meals, 0 streak, 0 stats).
- Added skeleton loading states for profile metrics to eliminate flash of zeroes.
- Preserved all food RAG datasets and nutritional dictionaries intact.

---

## [Initial Audit] Hygiene & Refactoring Pass

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

---

# Changelog — Revenue Curve Trajectory, Pipeline Calculations & Grocery Sync Audit

A major engineering and UI/UX pass replacing flat progress bars with high-contrast FinTech-style spline curves, auditing calculation pipelines, and connecting end-to-end grocery synchronization across the full stack.

## Highlights

1. **Revenue-Style Trajectory Chart (`src/components/RevenueCurveChart.tsx`):**
   - Implemented a pure Catmull-Rom to cubic Bézier spline generator ($\alpha = 0.5$ centripetal parameterization) rendering continuous $C^1$ smooth curves across irregular meal time intervals without external charting library dependencies.
   - Flowing soft-orange gradient area fill under actual logged calorie path ($0 \rightarrow \text{Current kcal}$, flat after the latest meal).
   - Dashed projection forecast curve gently continuing toward the daily target (e.g. 2269 kcal) by evening, marked as **পূর্বাভাস / Forecast** in the legend badge.
   - Olive dashed reference line (`#4F772D`) labeled `দৈনিক লক্ষ্য ২২৬৯` / `Target: 2269 kcal` with a target flag.
   - Real Bengali and English X and Y axes ticks (`সকাল ৮টা`, `দুপুর ১২টা`, `বিকাল ৪টা`, `রাত ৮টা`, `রাত ১১টা` / `8 AM`, `12 PM`, `4 PM`, `8 PM`, `11 PM`; `০`, `১০০০`, `২০০০`, `২৫০০` kcal) with subtle gridlines.
   - Draw-in animation from left to right on mount with pulsing active marker dot and interactive hover/tap tooltips.
   - High-contrast stat chips for Protein, Carbs, and Fat with progress pills and deep ink (`#2E2522`) typography.
   - Responsive vector SVG (`viewBox="0 0 540 220"`) fitting all screens from 320px mobile to desktop.
   - Deployed across:
     - `CaptureScreen.tsx`: Replaces flat horizontal mini-bar in Today's Summary.
     - `SummaryCard.tsx`: Toggleable mode switch `[ 📈 গতিপথ / Curve | 📊 ম্যাক্রো / Macros ]`.
     - `NutrientsScreen.tsx`: Featured meal trajectory and daily intake card.

2. **High-Contrast Pill Meters (`src/components/Bar.tsx`):**
   - Upgraded flat 8px dull bars to modern 10px pill meters with linear gradients (`#D96B27` $\rightarrow$ `#E87A38`, `#D97706` $\rightarrow$ `#F59E0B`, `#DC2626` $\rightarrow$ `#EF4444`, `#4F772D` $\rightarrow$ `#689F38`).
   - Benchmark target notch indicator at 100% and over-target badge.
   - Glossy top highlight for elevated FinTech aesthetic and high-contrast typography.
   - Upgraded SHAP Explainability mini-bars in `NutrientsScreen.tsx` to 8px pill gauges with bold percentage tags.

3. **Smart Dietary Pivot Engine & Grocery Sync (`src/lib/pivotEngine.ts`):**
   - Broadened carb detection beyond white rice to include pasta, noodles, spaghetti, macaroni, potatoes, bread, and meals with carbs $\ge 50\text{g}$.
   - Added tailored `pivot-pasta-veggie-swap`: portion-controlled pasta + steamed broccoli & zucchini, delivering $-45\text{g}$ net carbs, $+6\text{g}$ fiber, and $-110\text{ kcal}$.
   - Added guaranteed fallback fresh produce and micronutrient salad booster so **every meal uploaded always has an active Smart Dietary Pivot card with actionable grocery items**.
   - Added direct `[ 🛒 Add to Grocery / বাজারে যোগ ]` button on `ResultsScreen.tsx` for 1-tap addition of detected ingredients.
   - Full end-to-end grocery synchronization: dispatches `grocery-updated` event, updates category buckets (`Produce`, `Protein`, `Grains & staples`), and keeps `GroceryScreen.tsx` in real-time sync.

4. **Calculation Pipeline & Global Foods Audit:**
   - Identified and resolved calculation discrepancy where cooked pasta meals fell through to an unconfigured 110 kcal fallback. Added canonical profiles for `Penne Pasta`, `Pasta`, `Spaghetti`, `Macaroni`, `Noodles`, and `Parsley` into `food_aliases.json`, `foodAliases.ts`, and `personalize.ts`.
   - Added `updateLatestMeal()` in `src/lib/api.ts` and `handleDetectedChange()` in `src/App.tsx`: whenever nutrition facts are resolved or portion sliders are adjusted in `ResultsScreen`, the latest meal in `mealHistory` and `TodaySummary` are updated immediately.
   - Fixed `mealsLogged={detected.length}` bug in `NutrientsScreen.tsx`: added dedicated `subtitle` prop to `RevenueCurveChart` and referenced true count of meals logged today.
   - Added `meal-history-updated` event dispatch and listener in `CaptureScreen.tsx`, guaranteeing total synchronization between Recent Meals, Today's Summary, Results, and Nutrients screen.

5. **Schema Drift Guard & Backend Stability:**
   - Synchronized `app/models/schemas.py#GroceryItem` with `category: str | None = None` matching TypeScript contract.
   - All 129 backend pytest tests and 68 frontend Vitest tests pass 100% green.

6. **AI Coach Persona (`CoachScreen.tsx`):**
   - Updated AI coach identity to Dr. Susmit (ড. সুস্মিত - পুষ্টি বিজ্ঞানী) with BIRDEM, ICMR-NIN, and ADA guidelines.

## Test surface after this update

| Suite | Tests | Result |
|---|---|---|
| vitest (frontend, 13 test files) | 68 | **PASS** |
| pytest (backend, incl. schema drift) | 129 | **PASS** |
| tsc --noEmit (TypeScript typecheck) | clean | **0 errors** |
| vite build (Production bundle) | clean | **1.18s** |
