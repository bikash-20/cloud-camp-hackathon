# Image Upload Flow

> **TL;DR:** A user captures or uploads a photo on `CaptureScreen`, the
> photo becomes a JPEG data URL, the app calls `analyzeMeal(dataUrl)`,
> the backend checks the vector cache, runs configured vision providers
> if no cache hit, reconciles available outputs, estimates
> portions, and returns a list of `DetectedItem` plus a per-stage
> `PipelineTrace`. The app then calls `resolveNutrition` to attach
> per-100g nutrition from the OFF → USDA → Fruityvice cascade. The
> user confirms; a `MealEntry` is built and saved to browser localStorage.

This file is the frame-by-frame trace. Every step links to the actual
code, and every byte format is documented inline.

---

## 0. Current behavior and limitations

Image analysis calls the FastAPI backend when `VITE_API_BASE` is
configured. An uploaded photo is never replaced with canned vision
detections if the backend or vision provider is unavailable. Profile,
grocery, authentication, and portions of meal history still use seeded
or browser-local demo state; see the production limitations in
[README.md](../README.md#backend).

---

## 1. User taps "Capture"

**File:** `src/components/screens/CaptureScreen.tsx`

The `CaptureScreen` has three phases tracked in local state:
`idle | camera | captured`.

1. User taps the camera button → state flips to `'camera'`.
2. `useEffect` calls `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`.
   - Rear camera preferred; the user can flip to the front camera via the in-UI toggle.
   - The stream is attached to a `<video>` element via `srcObject`.
3. User taps the shutter button → `captureFrame()` runs:
   ```ts
   const canvas = document.createElement('canvas');
   canvas.width = video.videoWidth;
   canvas.height = video.videoHeight;
   canvas.getContext('2d').drawImage(video, 0, 0);
   const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
   ```
   - A 6 MP JPEG at quality 0.92 base64-encodes to ~1 MB.
4. The data URL is stored in component state, the video stream is stopped, state flips to `'captured'`, and a preview thumbnail is rendered.

The shutter also calls the `onCapture(dataUrl)` prop, which bubbles up
to `App.tsx#UserApp` and stores the data URL in app-level state.

---

## 2. App calls `analyzeMeal(dataUrl)`

**File:** `src/lib/api.ts#analyzeMeal`

`analyzeMeal` sends the uploaded image data URL to the backend.
**Wire format:**
```http
POST /api/vision/analyze HTTP/1.1
Host: localhost:8000
Origin: http://localhost:5173
Content-Type: application/json
Content-Length: 1234567

{ "image_ref": "data:image/jpeg;base64,/9j/4AAQ..." }
```

**Pydantic shape** (`app/api/vision.py`):
```python
class AnalyzeRequest(BaseModel):
    image_ref: str
```

**CORS:** the request will be preceded by an `OPTIONS /api/vision/analyze`
preflight. `app/main.py` reads `CORS_ALLOW_ORIGINS` (comma-separated
env var) and configures `CORSMiddleware` with it. Default is
`http://localhost:5173,http://127.0.0.1:5173` (Vite dev server).

**Body size cap:** the route enforces **8 MB** (`_MAX_REQUEST_BYTES = 8 * 1024 * 1024`).
A request with `Content-Length > 8388608` is rejected with `413 Payload Too Large`
before any cache or external API is touched. The error message names
the cap and suggests a multipart upload path. A 50 MB data-URL payload
can OOM a worker; the cap exists to prevent that.

---

## 3. Backend vision pipeline

**File:** `app/api/vision.py#analyze_meal`

The route runs a multi-stage pipeline surfaced as a `PipelineTrace` in the response: cache check, multi-provider vision cascade (Groq → Gemini → OpenRouter → Gemini Fallback → HuggingFace), and confidence-weighted reconciliation.

### Stage 1: cache-check (always first)

```python
pipeline: list[PipelineTrace] = [
    make_trace("cache-check", "Cache check", "running"),
]
```

The vector cache is checked:
- **Vector cache** (`app/cache/vector_cache.py`, ChromaDB) — exact
  match on the SHA-256 digest of the image data URL. If
  `vector_cache.has(cache_key)` returns
  truthy and `vector_cache.get(cache_key)` returns a non-empty list, the
  stage flips to `cache-hit` and three more cache-hit stages are
  appended (`vision-id`, `hf-validate`, `reconcile`). The route returns
  immediately.
On miss, the stage flips to `done` and execution continues. Successful
results are also written to a SQLite TTL cache.

### Stage 2: vision-id (Multi-tier provider cascade)

The system executes a fail-safe, multi-tier provider cascade to ensure lightning-fast processing, zero downtime, and robust fallback when external quotas are saturated:

1. **Tier 1: Groq Vision (Fastest LPU Inference):**
   - **File:** `app/services/groq_client.py`
   - Model: `llama-3.2-11b-vision-preview` (fallback `llama-3.2-90b-vision-preview`).
   - Sub-second inference time via Groq LPUs. Evaluates food detection, portion gram estimation, and restaurant menu OCR if applicable.
   - If Groq succeeds with confident food detection ($\ge 0.45$), it resolves immediately. On rate-limit (429), quota exhaustion, or failure, it logs a warning and cascades to Tier 2.

2. **Tier 2: Google Gemini 2.0 Flash (Primary High-Accuracy Vision):**
   - **File:** `app/services/gemini_client.py`
   - Model: `gemini-2.0-flash`.
   - Comprehensive multimodal detection with strict JSON output format (`[{name, confidence, grams, bbox?}]`).
   - On 429 quota or timeout, gracefully cascades to Tier 3.

3. **Tier 3: OpenRouter Vision (Free Multimodal Cascade):**
   - **File:** `app/services/openrouter_client.py`
   - Active multimodal model cascade (including Nemotron and free vision models).
   - Provides resilient failover when primary API quotas are exhausted.

4. **Tier 4: Google Gemini Secondary Fallback:**
   - Fallback models: `gemini-1.5-flash-8b` / `gemini-1.5-flash` with distinct quota pools.

5. **Tier 5: Hugging Face Classifier (Validator & Fallback):**
   - **File:** `app/services/hf_client.py`
   - Validates food categories and supplies bounding-box/label classification.

If all providers fail or are unconfigured, the route returns HTTP 503 (`Vision Service Temporarily Unavailable`).

### Stage 3: reconcile & portion estimation

**Files:** `app/services/reconcile.py` & `app/services/portion.py`

- `reconcile.merge`: Merges provider outputs with overlapping bounding boxes and resolves duplicate item detections using confidence-weighted heuristics.
- `portion.estimate`: Bounding-box volumetric density estimation mapping category-specific food densities to realistic gram weights.

### Stages 4–5: persist + respond

Caches successful detections in ChromaDB vector cache and SQLite TTL cache. Returns `AnalyzeResult(detected=detected, pipeline=pipeline)`.

```json
{
  "detected": [
    {
      "name": "chicken",
      "confidence": 87.5,
      "grams": 180.0,
      "note": null,
      "bbox": [0.42, 0.31, 0.18, 0.22]
    }
  ],
  "pipeline": [
    { "stage": "cache-check", "status": "done", "startedAt": 1729…, "finishedAt": 1729…, "label": "Cache check" },
    { "stage": "vision-id", "status": "done", "startedAt": 1729…, "finishedAt": 1729…, "label": "Vision ID (Gemini)" },
    { "stage": "hf-validate", "status": "done", "startedAt": 1729…, "finishedAt": 1729…, "label": "HF validator" },
    { "stage": "reconcile", "status": "done", "startedAt": 1729…, "finishedAt": 1729…, "label": "Confidence-weighted reconcile" }
  ]
}
```

---

## 4. ResultsScreen renders

**File:** `src/components/screens/ResultsScreen.tsx`

The screen takes `detected` and `pipeline` as props:
- The pipeline trace becomes an animated toast in the top-right.
- The detected items become a list of `ExpandableRow` components, each
  showing the food name, confidence ring, portion +/- controls, and
  glycemic chip (for diabetic profiles).
- Direct 1-tap `[ 🛒 Add to Grocery / বাজারে যোগ ]` button adjacent to Share button, allowing instant grocery list sync without leaving the screen.
- Step progression header (`Review` → `Adjust` → `Confirm`).
- Sort menu (confidence, calories, name, portion size).
- Bulk action bar appears when the user multi-selects items.
- "Confirm all" / "Add custom" actions.
- Real-time sync: when portions are edited via `handleDetectedChange`, `updateLatestMeal()` updates `mealHistory` and notifies listening components via the `meal-history-updated` event.

The user can edit portions, rename items, replace with alternatives, delete items, or add custom items. All edits update local component state.

---

## 5. `resolveNutrition(items, profile)`

**File:** `src/lib/api.ts#resolveNutrition` (local demo fallback when `VITE_API_BASE` is empty; otherwise the backend route)

After the user confirms the items on `ResultsScreen`, the app calls:

```ts
resolveNutrition(detectedItems, profile)
  → { resolved: ResolvedItem[], contributions: NutrientContribution[] }
```

**`ResolvedItem`** extends `DetectedItem` with:
- `nutrition: NutritionFacts | null` — per-100g macros/micros
- `descriptor: FoodDescriptor | null` — emoji, category, pairings
- `source: 'open-food-facts' | 'usda' | 'fruityvice' | 'cache' | 'estimated'`
- `partial: boolean | undefined` — true if the resolver matched an "estimated" entry

**Cascade order** (real backend, `app/api/nutrition.py`):
1. **Open Food Facts** (`app/services/off_client.py`) — large public
   DB, no key, has macros + micros for branded products.
2. **USDA FDC** (`app/services/usda_client.py`) — government DB,
   `DEMO_KEY` works without signup (rate-limited).
3. **Fruityvice** (`app/services/fruityvice_client.py`) — fruit-only,
   no key, no micros. Used last because it has the narrowest coverage.

The cascade stops at the first DB that returns a confident match
(non-zero kcal + non-empty macros). Each client returns `None` on
miss / error so the next one is tried. Global food profiles (pasta, noodles, spaghetti, macaroni, parsley) and regional Bangladeshi dishes (`bd_food_composition.json`) provide verified facts, ensuring accurate calculations.

`NutrientContribution` is built from the resolved items using the
flag rules in `app/services/personalize.py` (mirrored on the frontend
in `src/lib/personalize.ts`):
- sodium > `MOCK_TARGETS.sodium` → red flag
- sugar > `MOCK_TARGETS.sugar` → red flag (or green for diabetic profiles)
- fiber < `MOCK_TARGETS.fiber` → red flag (low is bad)
- …etc, see `FLAG_RULES` in `src/lib/personalize.ts`

Each contribution includes a `reason` string and a `tone: 'good' | 'warn'`.

---

## 6. NutrientsScreen renders

**File:** `src/components/screens/NutrientsScreen.tsx`

The screen renders:
- **Revenue-Style Intake Curve (`RevenueCurveChart.tsx`):**
  - FinTech Catmull-Rom spline curve with soft orange gradient fill representing actual meal intake.
  - Dashed forecast curve continuing gently toward the daily target (e.g. 2269 kcal), marked as **পূর্বাভাস / Forecast**.
  - Olive target line (`দৈনিক লক্ষ্য ২২৬৯` / `Target: 2269 kcal`).
  - Bengali and English X/Y axes ticks (`৮ AM`, `১২ PM`, `৪ PM`, `৮ PM`, `১১ PM`; `০`, `১০০০`, `২০০০`, `২৫০০` kcal) with draw-in animation and high-contrast stat chips.
  - Dynamically displays accurate meals logged count (`todaySummary.mealsLogged`) and meal calories via the `subtitle` prop.
- **Smart Dietary Pivot & Market Intelligence (`pivotEngine.ts`):**
  - Generates meal-specific swaps with exact macro and BDT market price deltas (e.g. Low-Sodium Gravy Pivot, Pasta & Steamed Veggies Swap, or Antioxidant Salad Booster).
  - 1-click `[ 🛒 Add pivot items to Grocery List ]` button automatically syncing recommended items with categories into the Grocery tab.
- **Macro Donuts:** (protein, carbs, fat) with animated count-up and deep ink (`#2E2522`) labels.
- **Modern Pill Meters:** 10px high-contrast gradient meters (`src/components/Bar.tsx`) with benchmark notches and over-target badges for fiber, sodium, and sugar.
- **SHAP Explainability Strip:** "Why these flags?" section breaking down individual food contributions with 8px pill gauges and bold percentages.
- **Live Sync:** on mount, updates latest meal totals in history via `updateLatestMeal()` and fires `meal-history-updated`.

The user can navigate back to `ResultsScreen` (preserving edits) or forward to `GroceryScreen` or `ProfileScreen`.

---

## 7. User logs the meal

**File:** `src/lib/api.ts#saveMeal` & `updateLatestMeal`

When the user taps "Save" on `NutrientsScreen`:

```ts
const meal: MealEntry = {
  id: `meal_${Date.now()}`,
  date: new Date().toISOString(),
  label: detectedItems.map(i => i.name).join(', '),
  items: detectedItems,
  totals: { kcal, protein, carbs, fat, fiber, sodium, sugar },
  photoUrl: capturedDataUrl,
  activeGoals: profile.goals,
};
saveMeal(meal);
```

`saveMeal()` pushes onto `mealHistory` (in-memory) and writes the
array to `localStorage` under the `meal_history` key via
`src/lib/storage.ts`. Any later portion or item adjustments call `updateLatestMeal(meal)`, which replaces the latest entry and dispatches `meal-history-updated`. (Real backend: also `POST /api/meals` to
`app/api/meals.py`, which inserts into `app/services/state.py`.)

---

## 8. TodaySummary refreshes

**File:** `src/lib/api.ts#getTodaySummary`

After save or update:
- Filters `mealHistory` for meals dated today.
- Sums `totals` across those meals.
- Returns `{ mealsLogged, totalKcal, totalProtein, totalCarbs, totalFat, dailyKcalTarget }`.

`CaptureScreen` listens for the `meal-history-updated` event so Today's Summary and Recent Meals cards re-render instantly without page reload.

---

## 9. Persistence summary

| What | Where | When |
|---|---|---|
| Captured photo (data URL) | Component state → `mealHistory[i].photoUrl` in localStorage | On save / capture |
| Detected items | Component state | While editing on `ResultsScreen` |
| Resolved nutrition | `MealEntry.totals` | On resolve & on save |
| Profile | localStorage `profile` key | On every `updateProfile` |
| Grocery list (with `category`) | localStorage `grocery` key | On every grocery mutation / 1-tap add |
| Meal history | localStorage `meal_history` key | On `saveMeal` & `updateLatestMeal` |
| Auth session | localStorage `nv_auth` key | On login / signout |
| Server state | `app/state.json` (default `STATE_PATH`) | On every backend mutation |

---

## 10. Failure modes (and what the user sees)

| Failure | User experience | Where it's handled |
|---|---|---|
| No `getUserMedia` (laptop with no camera) | File-upload fallback button | `CaptureScreen` |
| User denies camera permission | Inline error, file-upload fallback | `CaptureScreen` |
| Backend 413 (body too large) or 5xx | Analysis error with retry action; no sample meal is saved | `App.tsx`, `ResultsScreen.tsx` |
| No `GEMINI_API_KEY` and no `HF_API_TOKEN` | HTTP 503 and analysis error; no sample detections | `app/api/vision.py` |
| No nutrition DB matches an item | `source: 'estimated'`, `partial: true` | `app/api/nutrition.py` |
| localStorage quota exceeded | Toast: "Storage full" | `src/lib/storage.ts` swallows and warns |

---

## 11. Latency budget

| Stage | Behavior |
|---|---|---|
| Capture + render preview | ~50 ms |
| `analyzeMeal` round-trip | Provider latency; depends on configured Gemini and optional HF |
| Cache hit | ~30 ms |
| `resolveNutrition` cascade | Depends on external nutrition providers and cache |

The 8 MB body cap limits image request size to protect the service.

---

## 12. Cross-references

- The full list of `PipelineTrace` stages and their literal values: [schemas.md](./schemas.md#allowed-divergences).
- The flag rules that power the SHAP-style explainability: [frontend/components.md](./frontend/components.md#nutrientsscreen) and `src/lib/personalize.ts`.
- The full backend HTTP client logging behavior: [backend/services.md](./backend/services.md#_http_loggingpy).
- The CORS configuration: [backend/README.md](./backend/README.md#cors).
