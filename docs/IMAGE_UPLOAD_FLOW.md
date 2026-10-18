# Image Upload Flow

> **TL;DR:** A user taps the camera shutter on `CaptureScreen`, the
> photo becomes a JPEG data URL, the app calls `analyzeMeal(dataUrl)`,
> the backend checks the vector cache, runs Gemini + HuggingFace in
> parallel if no cache hit, reconciles the two outputs, estimates
> portions, and returns a list of `DetectedItem` plus a per-stage
> `PipelineTrace`. The app then calls `resolveNutrition` to attach
> per-100g nutrition from the OFF → USDA → Fruityvice cascade. The
> user confirms; a `MealEntry` is built and saved to localStorage (and
> `app/state.json` on the backend).

This file is the frame-by-frame trace. Every step links to the actual
code, and every byte format is documented inline.

---

## 0. Where we are right now

**Important context:** the frontend (`src/lib/api.ts`) is still running
on the **mock API** in production. The backend is fully cut-b-ready
but not yet wired into the deployed PWA. The trace below is what
**actually happens today** (with `delay()` simulating latency) and
what **will happen** once `api.ts` is swapped to real `fetch()` calls.
The byte-level wire format is identical in both cases — that's the
whole point of the mock.

To verify the real backend works end-to-end today, see
[development.md](./development.md#smoke-testing-the-real-backend).

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

```ts
export async function analyzeMeal(imageRef: string): Promise<AnalyzeResult> {
  await delay(700, 1400);  // simulated latency
  const detected = MOCK_DETECTED[imageRef] ?? MOCK_DETECTED.default;
  const pipeline: PipelineTrace[] = [/* canned stages */];
  return { detected, pipeline };
}
```

**Wire format** (what the real backend will receive):
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

The route runs 9 named stages, each surfacing as a `PipelineTrace`
entry in the response. The toast on `ResultsScreen` reads these
entries to render the animated "Cache check → Vision ID → HF validator
→ Reconcile → Nutrition → Portion → Personalize → Explain" strip.

### Stage 1: cache-check (always first)

```python
pipeline: list[PipelineTrace] = [
    make_trace("cache-check", "Cache check", "running"),
]
```

Two caches are checked:
- **Vector cache** (`app/cache/vector_cache.py`, ChromaDB) — semantic
  match on image embedding. If `vector_cache.has(image_ref)` returns
  truthy and `vector_cache.get(image_ref)` returns a non-empty list, the
  stage flips to `cache-hit` and three more cache-hit stages are
  appended (`vision-id`, `hf-validate`, `reconcile`). The route returns
  immediately.
- **SQLite TTL cache** (`app/cache/sqlite_cache.py`) — exact-string
  match. Consulted only on the live-pipeline path, used as a redundant
  fallback when the vector cache is cold.

On miss, the stage flips to `done` and execution continues.

### Stage 2: vision-id (Gemini, if configured)

**File:** `app/services/gemini_client.py`

`GeminiClient.detect(image_ref)`:
1. Reads the data URL → `(base64_payload, mime_type)`. Also accepts
   local file paths.
2. `POST` to `{base_url}/{model}:generateContent?key={api_key}` with
   an `inline_data` part containing the base64 image and a strict-JSON
   prompt asking for `[{name, confidence, grams, bbox?}, ...]`.
3. On `5xx` / timeout → `log_http_failure("Gemini", exc, image_ref=...)` at `WARNING`.
4. On `429` → `ERROR` with rate-limit hint.
5. On `401` / `403` → `ERROR` with config hint (`check GEMINI_API_KEY env var`).
6. Returns `[]` on any error so the route can degrade gracefully.
7. Parses the response with a tolerant regex (Gemini sometimes wraps
   JSON in ```json ... ``` fences) and emits a list of `DetectedItem`.

If `GEMINI_API_KEY` is unset, `is_configured()` returns `False` and the
client short-circuits to `[]`. The route then sets the `vision-id`
stage to `fallback` (not an error — the demo degrades cleanly).

### Stage 3: hf-validate (HuggingFace, if configured)

**File:** `app/services/hf_client.py`

`HFClient.classify(image_ref)`:
1. Same data-URL → base64 decoding as Gemini.
2. `POST` to the HF Inference API with the image as a binary body.
3. Returns top-K labels as `{name, confidence, bbox?}`.
4. Same severity-graded logging as Gemini.

If `HF_API_TOKEN` is unset, returns `[]`. Stage is `fallback`.

### Stage 4: reconcile (confidence-weighted merge)

**File:** `app/services/reconcile.py`

`reconcile.merge(gemini_items, hf_labels)`:
- Pure function, no I/O.
- Confidence-weighted merge: items in both sets with overlapping
  bboxes are merged using max-confidence, items in only one set are
  kept.
- Returns a single `list[DetectedItem]`.

Stage status is `done` if both clients returned data, `fallback` if only one did, `done` if the canned fixture was used.

### Stage 5: portion (per-item)

**File:** `app/services/portion.py`

`portion.estimate(item)`:
- Pure function, no I/O.
- If the item has a bbox, estimates grams from bbox area and a per-category density table (`DensityEntry`).
- If no bbox, leaves `grams` unchanged (the value Gemini returned).

### Stages 6–8: persist + respond

```python
detected = [d.model_copy(deep=True) for d in detected]

# 4. Persist so the next request for the same image_ref short-circuits.
if detected:
    try:
        vector_cache.put(body.image_ref, detected)
    except Exception:
        pass
    try:
        _get_sqlite_cache().put(
            ("vision", body.image_ref),
            [d.model_dump() for d in detected],
            ttl_s=_vision_ttl_s(),  # default 7d
        )
    except Exception:
        pass
```

Cache writes are best-effort. A failing cache write does **not** 500
the route — the response is built from the live pipeline output
regardless.

### Stage 9: response

```python
return AnalyzeResult(detected=detected, pipeline=pipeline)
```

Pydantic serializes the response. The frontend's
`analyzeMeal()` (when swapped to real `fetch`) will receive:

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
- Sort menu (confidence, calories, name, portion size).
- Bulk action bar appears when the user multi-selects items.
- "Confirm all" / "Add custom" actions.

The user can edit portions, rename items, replace with alternatives, delete items, or add custom items. All edits update local component state.

---

## 5. `resolveNutrition(items, profile)`

**File:** `src/lib/api.ts#resolveNutrition` (current mock) / `app/api/nutrition.py#resolve` (real)

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
miss / error so the next one is tried.

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
- Macro donuts (protein, carbs, fat) with animated count-up.
- Progress bars for fiber, sodium, sugar (`MiniBar` / `MacroMeter` from `src/components/Meter.tsx`).
- "Why these flags?" strip listing each flagged `NutrientContribution` with its reason.
- Meal context: photo thumbnail, date/time, total calories.
- "Share to clipboard" button.

The user can navigate back to `ResultsScreen` (preserving edits) or forward to `GroceryScreen` or `ProfileScreen`.

---

## 7. User logs the meal

**File:** `src/lib/api.ts#saveMeal`

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
`src/lib/storage.ts`. (Real backend: also `POST /api/meals` to
`app/api/meals.py`, which inserts into `app/services/state.py`.)

---

## 8. TodaySummary refreshes

**File:** `src/lib/api.ts#getTodaySummary`

After save, the app re-fetches `getTodaySummary()`, which:
- Filters `mealHistory` for meals dated today.
- Sums `totals` across those meals.
- Returns `{ mealsLogged, totalKcal, totalProtein, totalCarbs, totalFat, dailyKcalTarget }`.

The `CaptureScreen` Home section renders this — the "X of 2000 kcal
today" progress bar updates immediately.

---

## 9. Persistence summary

| What | Where | When |
|---|---|---|
| Captured photo (data URL) | Component state → `mealHistory[i].photoUrl` in localStorage | On save |
| Detected items | Component state | While editing on `ResultsScreen` |
| Resolved nutrition | `MealEntry.totals` | On save |
| Profile | localStorage `profile` key | On every `updateProfile` |
| Grocery list | localStorage `grocery` key | On every grocery mutation |
| Meal history | localStorage `meal_history` key | On every `saveMeal` |
| Auth session | localStorage `nv_auth` key | On login / signout |
| Server state | `app/state.json` (default `STATE_PATH`) | On every backend mutation |

---

## 10. Failure modes (and what the user sees)

| Failure | User experience | Where it's handled |
|---|---|---|
| No `getUserMedia` (laptop with no camera) | File-upload fallback button | `CaptureScreen` |
| User denies camera permission | Inline error, file-upload fallback | `CaptureScreen` |
| Backend 413 (body too large) | Toast: "Image too large" | `App.tsx` error boundary (real backend only) |
| Backend 5xx | Toast: "Analysis failed", Retry button | `App.tsx` error boundary (real backend only) |
| No `GEMINI_API_KEY` and no `HF_API_TOKEN` | Canned fixture via `VISION_KEYED_DETECTED` — no error | `app/api/vision.py` |
| No nutrition DB matches an item | `source: 'estimated'`, `partial: true` | `app/api/nutrition.py` |
| localStorage quota exceeded | Toast: "Storage full" | `src/lib/storage.ts` swallows and warns |

---

## 11. Latency budget

| Stage | Mock (today) | Real (cut-b) |
|---|---|---|
| Capture + render preview | ~50 ms | ~50 ms |
| `analyzeMeal` round-trip | 700–1400 ms (simulated) | 1.5–4 s (Gemini) + 0.5–1 s (HF, parallel) |
| Cache hit | 50 ms | ~30 ms |
| `resolveNutrition` cascade | 200–400 ms (mock DB lookup) | 1–3 s (3 HTTP calls) |
| Total | ~1–2 s | ~2–7 s |

The 8 MB body cap exists to keep the worst-case `analyzeMeal` request
under the typical browser/server timeout.

---

## 12. Cross-references

- The full list of `PipelineTrace` stages and their literal values: [schemas.md](./schemas.md#allowed-divergences).
- The flag rules that power the SHAP-style explainability: [frontend/components.md](./frontend/components.md#nutrientsscreen) and `src/lib/personalize.ts`.
- The full backend HTTP client logging behavior: [backend/services.md](./backend/services.md#_http_loggingpy).
- The CORS configuration: [backend/README.md](./backend/README.md#cors).
