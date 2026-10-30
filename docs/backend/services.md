# Backend Services

Per-service reference for every module in `app/services/` and
`app/cache/`. Each entry covers: purpose, public API, key
implementation notes, and where it's used.

---

## HTTP clients

### `groq_client.py`
Groq LPU vision client (Tier 1 fastest inference).

```python
from app.services.groq_client import GroqClient

client = GroqClient()  # reads GROQ_API_KEY from env
client.is_configured()   # True iff GROQ_API_KEY is set
result = client.detect_vision(image_ref)  # VisionDetectionResult
items = client.detect(image_ref)  # list[DetectedItem]
```

- Primary model: `llama-3.2-11b-vision-preview` (fallback `llama-3.2-90b-vision-preview`).
- Ultra-low latency LPU execution (~400-800ms).
- Evaluates food detection, confidence thresholding, portion estimation, and restaurant menu OCR.
- **Used by:** `app/api/vision.py` (Tier 1 primary in vision cascade).

---

### `gemini_client.py`
Google Gemini 2.0 Flash vision client (Tier 2 primary high-accuracy vision).

```python
from app.services.gemini_client import GeminiClient

client = GeminiClient()  # reads GEMINI_API_KEY from env
client.is_configured()    # True iff GEMINI_API_KEY is set
items = client.detect(image_ref)  # list[DetectedItem]
client.close()
```

**Prompt** (`_DETECTION_PROMPT`): asks for a strict-JSON array of
`{name, confidence, grams, bbox?}` items. No prose, no code fences.

**Response parsing** (`_parse_gemini_response`): tolerates
- JSON wrapped in ```json ... ``` fences (`_JSON_FENCE_RE`)
- JSON with a short preamble
- The documented `candidates[0].content.parts[0].text` shape OR a
  flat `text` field (`_extract_text`)

Returns `[]` on any error so the route can degrade.

**Used by:** `app/api/vision.py` (Tier 2 and Tier 4 fallback).

---

### `openrouter_client.py`
OpenRouter multimodal vision client (Tier 3 free cascade).

```python
from app.services.openrouter_client import OpenRouterVisionClient

client = OpenRouterVisionClient()  # reads OPENROUTER_API_KEY from env
client.is_configured()
result = client.detect_vision(image_ref)
```

- Provides automatic model failover using free and multimodal models (including Nemotron).
- **Used by:** `app/api/vision.py` (Tier 3 fallback).

---

### `hf_client.py`
HuggingFace Inference API classifier.

```python
from app.services.hf_client import HFClient

client = HFClient()  # reads HF_API_TOKEN from env
client.is_configured()
labels = client.classify(image_ref)  # list[DetectedItem]-shaped
client.close()
```

Mirrors `gemini_client.py`'s structure. Returns top-K labels
converted to `DetectedItem` shape (name, confidence 0-100, bbox
optional, grams defaulted).

**Used by:** `app/api/vision.py` (live path when `HF_API_TOKEN` is
set, runs in parallel with Gemini).

---

### `off_client.py`
Open Food Facts nutrition client.

```python
from app.services.off_client import OFFClient

client = OFFClient()
facts = client.lookup(name)  # NutritionFacts | None
```

Looks up `https://world.openfoodfacts.net/api/v2/search?categories_tags=...`
(or the search endpoint), parses the first hit's `nutriments` block,
returns per-100g `NutritionFacts`. Returns `None` on miss / 404 /
any error so the cascade can fall through.

Open Food Facts is free, no key, has macros + micros for branded
products. **First stop in the cascade** because it has the broadest
coverage.

**Used by:** `app/api/nutrition.py` (cascade).

---

### `usda_client.py`
USDA FoodData Central client.

```python
from app.services.usda_client import USDAClient

client = USDAClient()  # DEMO_KEY by default
facts = client.lookup(name)
```

Search endpoint `/foods/search` with `pageSize=1` and `dataType=Foundation,SR Legacy,Survey (FNDDS)`. Returns the top hit's per-100g
nutrition by mapping nutrient IDs:
- `1003` → protein
- `1004` → fat
- `1005` → carbs
- `1008` → kcal
- `1079` → fiber
- `1093` → sodium (mg)
- `210` / `200` → sugar

`DEMO_KEY` works without signup (rate-limited to ~30 req/hour/IP).
Get a personal key at <https://api.nal.usda.gov/ui/key.html> for
higher quotas.

**Used by:** `app/api/nutrition.py` (cascade, second stop).

---

### `fruityvice_client.py`
Fruityvice fruit-only client.

```python
from app.services.fruityvice_client import FruityviceClient

client = FruityviceClient()
facts = client.lookup(name)  # NutritionFacts | None
```

Exact-name lookup at `GET /fruit/{name}`. Returns `None` on miss
(404 is a normal miss, not an error). Reports kcal per 100g in
`nutritions.calories`; sodium, fiber, sugar aren't in the response,
so those stay at 0 (downstream treats sparse facts as "unknown").

**Used by:** `app/api/nutrition.py` (cascade, last stop).

---

## Pure-function services

### `reconcile.py`
Confidence-weighted merge of Gemini + HF outputs.

```python
from app.services.reconcile import merge

merged = merge(gemini_items, hf_labels)  # list[DetectedItem]
```

Pure function, no I/O. Items in both sets with overlapping bboxes
are merged using max-confidence. Items in only one set are kept.

**Used by:** `app/api/vision.py` (after Gemini and HF return).

---

### `portion.py`
Bbox-based portion estimation.

```python
from app.services.portion import estimate

estimated = estimate(item)  # DetectedItem with grams updated
```

Pure function, no I/O. If the item has a bbox, estimates grams from
bbox area and a per-category density table (`DensityEntry`). If no
bbox, leaves `grams` unchanged.

**Used by:** `app/api/vision.py` (after reconcile, per-item).

---

### `personalize.py`
Flag rules. Mirrors `src/lib/personalize.ts`.

```python
from app.services.personalize import evaluate_flags

contributions = evaluate_flags(items, profile)  # list[NutrientContribution]
```

**Used by:** `app/api/nutrition.py` (after resolve).

---

### `targets.py`
Daily kcal target resolver.

```python
from app.services.targets import resolve_target

target = resolve_target(profile)  # int (default 2000)
```

Returns `profile.dailyKcalTarget` if set, else 2000. Tolerates
older profiles that pre-date the `dailyKcalTarget` field.

**Used by:** `app/api/nutrition.py`, `app/api/meals.py` (today summary).

---

### `trace.py`
PipelineTrace convenience constructor.

```python
from app.services.trace import make_trace

t = make_trace("cache-check", "Cache check", "running")
# PipelineTrace(stage="cache-check", label="Cache check", status="running",
#               startedAt=now, finishedAt=None)
```

Sets `startedAt` to now, `finishedAt` to None.

**Used by:** `app/api/vision.py` (throughout the pipeline).

---

### `ocr.py`
Optional Tesseract wrapper. Currently a no-op (best-effort, no
detection mapping). It is not invoked as a fallback by the vision
route.

```python
from app.services.ocr import is_enabled, extract_text

if ocr.is_enabled():
    text = ocr.extract_text(image_ref)
```

Reads `TESSERACT_CMD` env var; `is_enabled()` returns `True` if
`pytesseract` is importable and `TESSERACT_CMD` is set.

---

## State and caches

### `state.py`
JSON-file-backed in-memory state singleton.

```python
from app.services.state import get_state

state = get_state()
state.profile.upsert(profile)
state.meals.upsert(meal)
state.grocery.upsert(item)
```

Each collection is a `Bucket[T]` — list + dict for O(1) lookups +
ordered iteration. Every mutation rewrites the JSON file.

**Used by:** every API route for persistence.

---

### `cache/sqlite_cache.py`
TTL exact-match cache.

```python
from app.cache.sqlite_cache import TTLCache

cache = TTLCache(Path("app/cache/cache.db"))
cache.put(("vision", image_ref), detections, ttl_s=7 * 24 * 60 * 60)
hits = cache.get(("vision", image_ref))  # list | None
```

SQLite-backed. Key is a tuple (route, identifier). Entries expire
after `ttl_s`. Survives restarts.

**Used by:** `app/api/vision.py` (writes only; the route does not read this cache yet).

---

### `cache/vector_cache.py`
ChromaDB-backed exact-ID cache. Despite the class name, the current
implementation does not compute image embeddings or semantic matches.

```python
from app.cache.vector_cache import VectorCache

cache = VectorCache()
if cache.has(image_digest):
    items = cache.get(image_digest)
    cache.put(image_digest, items)
```

`image_digest` is a SHA-256 digest of the uploaded image data URL.
`has()` and `get()` are no-ops (return `False` / `None`) if ChromaDB
is not installed or the path is unwritable.

**Used by:** `app/api/vision.py` (the primary fast path).

---

## Helpers

### `_http_logging.py`
Severity-graded HTTP failure logger.

```python
from app.services._http_logging import log_http_failure

try:
    resp = self._http().get(...)
    resp.raise_for_status()
except (httpx.HTTPError, ValueError) as exc:
    log_http_failure("Gemini", exc, image_ref=image_ref)
    return None
```

See [README.md](./README.md#the-_http_logging-helper) for the full
severity table.

**Used by:** all five HTTP clients.

---

## Seed data

### `seed/fixtures.py`
Seed data used for default profile, nutrition, and grocery behavior.
Vision requests do not use seeded detections as a provider fallback.

- `DEFAULT_PROFILE` — factory-fresh profile for Reset
- `default_grocery_items()` — seed grocery list

**Used by:** `app/services/state.py`.