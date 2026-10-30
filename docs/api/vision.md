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
| `vision-id` | Multi-tier cascade | `done` (Groq / Gemini / OpenRouter / Gemini Fallback) or `fallback` |
| `hf-validate` | Validator / fallback | `done` (HF) or `fallback` |
| `reconcile` | After vision-id + hf-validate | `done` or `fallback` |
| `nutrition` | (Reserved) | — |
| `portion` | (Reserved) | — |
| `personalize` | (Reserved) | — |
| `explain` | (Reserved) | — |

On a cache hit, only `cache-check` + `vision-id` (cache-hit) +
`hf-validate` (cache-hit) + `reconcile` (cache-hit) are emitted. On
a full live pipeline, all main stages are emitted.

### Behavior when no vision provider is configured

If `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, and `HF_API_TOKEN` are all unset or fail to respond, the route returns HTTP 503 (`Vision Service Temporarily Unavailable`). Any single configured provider is sufficient. The frontend surfaces the failure with a Retry Analysis action and never substitutes sample detections for an uploaded photo.

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
| `500 Internal Server Error` | Unexpected route or cache failure |

### Example (curl)

Send a valid image data URL in `image_ref` and configure at least one
vision provider. A sample filename is not an image and does not trigger
a fixture response. Tests should use controlled provider responses.
When no provider is configured, requests return HTTP 503.

### See also

- [IMAGE_UPLOAD_FLOW.md](../IMAGE_UPLOAD_FLOW.md) — frame-by-frame
  trace of one full request
- [schemas.md](../schemas.md) — `AnalyzeRequest`, `AnalyzeResult`,
  `DetectedItem`, `PipelineTrace` types
- [services.md](../backend/services.md) — gemini_client, hf_client,
  reconcile, portion