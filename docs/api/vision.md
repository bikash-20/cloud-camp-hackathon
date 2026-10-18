# Vision API

The headline route. When a user captures a photo on `CaptureScreen`,
this is the endpoint that processes it.

## `POST /api/vision/analyze`

Runs the vision pipeline. Returns detected items and a per-stage
trace.

### Request

```http
POST /api/vision/analyze HTTP/1.1
Content-Type: application/json
Content-Length: <8 MB max>

{
  "image_ref": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Body cap:** 8 MB. Requests with `Content-Length > 8388608` are
rejected with `413 Payload Too Large` before any cache or external
API is touched. The error message names the cap and suggests a
multipart upload path.

A 6 MP JPEG at quality 0.92 base64-encodes to ~1 MB; 8 MB gives
8× headroom for larger phone cameras.

**Schema:**
```python
class AnalyzeRequest(BaseModel):
    image_ref: str
```

The `image_ref` can be:
- A base64 data URL (`data:image/jpeg;base64,...`) — what the
  frontend's `captureFrame()` produces
- A local file path — useful for testing

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

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
    {"stage": "cache-check", "status": "done",       "startedAt": 1729…, "finishedAt": 1729…, "label": "Cache check"},
    {"stage": "vision-id",   "status": "done",       "startedAt": 1729…, "finishedAt": 1729…, "label": "Vision ID (Gemini)"},
    {"stage": "hf-validate", "status": "done",       "startedAt": 1729…, "finishedAt": 1729…, "label": "HF validator"},
    {"stage": "reconcile",   "status": "done",       "startedAt": 1729…, "finishedAt": 1729…, "label": "Confidence-weighted reconcile"}
  ]
}
```

**Schema:**
```python
class AnalyzeResult(BaseModel):
    detected: list[DetectedItem]
    pipeline: list[PipelineTrace]
```

### Pipeline stages

Each stage is a `PipelineTrace` entry surfaced in the animated toast
on `ResultsScreen`. The possible stages are:

| Stage | When | Status values |
|---|---|---|
| `cache-check` | Always first | `running` → `done` or `cache-hit` |
| `vision-id` | After cache miss | `done` (Gemini) or `fallback` |
| `hf-validate` | After cache miss | `done` (HF) or `fallback` |
| `reconcile` | After vision-id + hf-validate | `done` or `fallback` |
| `nutrition` | (Reserved) | — |
| `portion` | (Reserved) | — |
| `personalize` | (Reserved) | — |
| `explain` | (Reserved) | — |

On a cache hit, only `cache-check` + `vision-id` (cache-hit) +
`hf-validate` (cache-hit) + `reconcile` (cache-hit) are emitted. On
a full live pipeline, all 4 main stages are emitted.

The reserved stages (`nutrition`, `portion`, `personalize`,
`explain`) are placeholders for future cut-c work. They exist in the
schema so the toast UI doesn't need to change when they're wired up.

### Behavior when no API keys are set

If `GEMINI_API_KEY` and `HF_API_TOKEN` are both unset, the route
falls back to a canned fixture: `VISION_KEYED_DETECTED[image_ref]`
or `VISION_KEYED_DETECTED['default']`. The `vision-id` and
`hf-validate` stages are marked `fallback`. `reconcile` is also
`fallback`.

This is the demo mode — the app stays functional end-to-end without
any external services.

### Cache writes

On a successful live pipeline:
- The vector cache (`app/cache/vector_cache.py`) is updated with the
  merged detections.
- The SQLite TTL cache (`app/cache/sqlite_cache.py`) is updated with
  the same data, TTL = `VISION_CACHE_TTL` env var (default 7 days).

Both writes are best-effort. A failing write does **not** 500 the
route — the response is built from the live pipeline output
regardless.

### Errors

| Status | Cause |
|---|---|
| `413 Payload Too Large` | Request body > 8 MB |
| `422 Unprocessable Entity` | Request body fails Pydantic validation (e.g. missing `image_ref`) |
| `500 Internal Server Error` | Should not happen — all expected failures are caught and degraded |

### Example (curl)

```bash
curl -X POST http://localhost:8000/api/vision/analyze \
  -H "Content-Type: application/json" \
  -d '{"image_ref": "chicken_biryani.jpg"}'
```

The canned fixture `chicken_biryani.jpg` triggers a known-good
response. Other strings return the canned `default` fixture when
both clients are unconfigured.

### See also

- [IMAGE_UPLOAD_FLOW.md](../IMAGE_UPLOAD_FLOW.md) — frame-by-frame
  trace of one full request
- [schemas.md](../schemas.md) — `AnalyzeRequest`, `AnalyzeResult`,
  `DetectedItem`, `PipelineTrace` types
- [services.md](../backend/services.md) — gemini_client, hf_client,
  reconcile, portion