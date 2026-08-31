"""Vision pipeline route.

Mirrors `src/lib/api.ts#analyzeMeal`. The frontend passes `image_ref`
(a string like `'chicken_biryani.jpg'` or a base64 data URL); the route:

  1. Looks up `image_ref` in the vector cache. On hit, returns cached
     detections + a `cache-hit` trace stage.
  2. Otherwise runs Gemini + HF in parallel (each only if its key is
     set) and merges via `reconcile.merge`.
  3. Applies `portion.estimate()` to each item.
  4. Persists the merged list to both the vector cache and the TTL
     cache, then returns it.
  5. If neither client is configured, falls back to the canned
     `VISION_KEYED_DETECTED` so the demo continues to work without keys.

The contract is locked: request shape is `AnalyzeRequest`, response
shape is `AnalyzeResult`. Only the internals change vs. cut (a).
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from app.cache.sqlite_cache import TTLCache
from app.cache.vector_cache import VectorCache
from app.models.schemas import AnalyzeResult, DetectedItem, PipelineTrace
from app.seed.fixtures import VISION_KEYED_DETECTED
from app.services import ocr
from app.services import portion as portion_svc
from app.services import reconcile as reconcile_svc
from app.services.gemini_client import GeminiClient
from app.services.hf_client import HFClient
from app.services.trace import make_trace


router = APIRouter(prefix="/api/vision", tags=["vision"])


# Process-wide clients. Lazy-instantiated so tests that never call the
# vision route can avoid pulling httpx + chromadb at import time.
_gemini: GeminiClient | None = None
_hf: HFClient | None = None
_vector_cache: VectorCache | None = None
_sqlite_cache: TTLCache | None = None


def _get_gemini() -> GeminiClient:
    global _gemini
    if _gemini is None:
        _gemini = GeminiClient()
    return _gemini


def _get_hf() -> HFClient:
    global _hf
    if _hf is None:
        _hf = HFClient()
    return _hf


def _get_vector_cache() -> VectorCache:
    global _vector_cache
    if _vector_cache is None:
        _vector_cache = VectorCache()
    return _vector_cache


def _get_sqlite_cache() -> TTLCache:
    global _sqlite_cache
    if _sqlite_cache is None:
        path = Path(os.environ.get("SQLITE_CACHE_PATH", "app/cache/cache.db"))
        _sqlite_cache = TTLCache(path)
    return _sqlite_cache


def _reset_for_tests() -> None:
    """Drop the cached clients so the next call recreates them with
    whatever env vars are in scope. Test-only — do not call from prod."""
    global _gemini, _hf, _vector_cache, _sqlite_cache
    if _gemini is not None:
        _gemini.close()
    if _hf is not None:
        _hf.close()
    _gemini = _hf = None
    _vector_cache = None
    _sqlite_cache = None


# Vision cache TTL (default 7d). Falls back to the canonical env var.
def _vision_ttl_s() -> int:
    raw = os.environ.get("VISION_CACHE_TTL", "")
    if raw.isdigit() and int(raw) > 0:
        return int(raw)
    return 7 * 24 * 60 * 60


class AnalyzeRequest(BaseModel):
    """Request body for `analyze_meal`."""

    image_ref: str


@router.post("/analyze", response_model=AnalyzeResult)
def analyze_meal(body: AnalyzeRequest) -> AnalyzeResult:
    """Vision pipeline — see module docstring for the full flow."""
    pipeline: list[PipelineTrace] = [
        make_trace("cache-check", "Cache check", "running"),
    ]

    # 1. Vector cache (ChromaDB) — fast path. Falls through silently
    #    when chromadb is not installed or the path is unwritable.
    vector_cache = _get_vector_cache()
    if vector_cache.has(body.image_ref):
        cached = vector_cache.get(body.image_ref)
        if cached:
            pipeline[0].status = "cache-hit"
            pipeline.extend(
                [
                    make_trace("vision-id", "Vision ID (cached)", "cache-hit"),
                    make_trace("hf-validate", "HF validator (cached)", "cache-hit"),
                    make_trace("reconcile", "Reconcile (cached)", "cache-hit"),
                ]
            )
            return AnalyzeResult(detected=cached, pipeline=pipeline)
    pipeline[0].status = "done"

    # 2. Live pipeline: Gemini (if key) || HF (if key).
    gemini = _get_gemini()
    hf = _get_hf()
    gemini_items = gemini.detect(body.image_ref) if gemini.is_configured() else []
    hf_labels = hf.classify(body.image_ref) if hf.is_configured() else []

    if gemini_items or hf_labels:
        merged = reconcile_svc.merge(gemini_items, hf_labels)
        detected = [portion_svc.estimate(it) for it in merged]
        pipeline.extend(
            [
                make_trace(
                    "vision-id",
                    "Vision ID (Gemini)",
                    "done" if gemini_items else "fallback",
                ),
                make_trace(
                    "hf-validate",
                    "HF validator",
                    "done" if hf_labels else "fallback",
                ),
                make_trace(
                    "reconcile",
                    "Confidence-weighted reconcile",
                    "done" if gemini_items and hf_labels else "fallback",
                ),
            ]
        )
    else:
        # 3. No keys → canned fixture, identical to cut (a).
        detected = VISION_KEYED_DETECTED.get(body.image_ref) or []
        if not detected and ocr.is_enabled():
            # OCR fallback: best-effort, no detection mapping in cut (b).
            ocr.extract_text(body.image_ref)
        pipeline.extend(
            [
                make_trace("vision-id", "Vision ID (stub)", "fallback"),
                make_trace("hf-validate", "HF validator (stub)", "fallback"),
                make_trace("reconcile", "Reconcile (skipped)", "fallback"),
            ]
        )

    detected = [d.model_copy(deep=True) for d in detected]

    # 4. Persist so the next request for the same image_ref short-circuits.
    if detected:
        try:
            vector_cache.put(body.image_ref, detected)
        except Exception:  # noqa: BLE001 — cache writes must never 500 the route
            pass
        try:
            _get_sqlite_cache().put(
                ("vision", body.image_ref),
                [d.model_dump() for d in detected],
                ttl_s=_vision_ttl_s(),
            )
        except Exception:  # noqa: BLE001
            pass

    return AnalyzeResult(detected=detected, pipeline=pipeline)


# Re-exported for test fixtures.
__all__ = ["router", "AnalyzeRequest", "AnalyzeResult", "_reset_for_tests"]
