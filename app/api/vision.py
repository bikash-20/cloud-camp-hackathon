"""Vision pipeline stub.

Mirrors `src/lib/api.ts#analyzeMeal`. The frontend passes `image_ref`
(a string like `'chicken_biryani.jpg'`); for cut (a) the skeleton
returns the canned `DetectedItem` list keyed off that string.

Cut (b) replaces the body of `analyze_meal()` with real Gemini calls.
The contract is locked: the request shape is `AnalyzeRequest`, the
response shape is `AnalyzeResult`. Only the internals change.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.models.schemas import AnalyzeResult, DetectedItem, PipelineTrace
from app.seed.fixtures import VISION_KEYED_DETECTED
from app.services import ocr
from app.services.trace import make_trace as trace


router = APIRouter(prefix="/api/vision", tags=["vision"])


class AnalyzeRequest(BaseModel):
    """Request body for `analyze_meal`.

    `image_ref` is opaque to the backend for cut (a) — it's just a key
    that maps to a canned `DetectedItem[]` via `VISION_KEYED_DETECTED`.
    Cut (b) will treat it as either a local file path, a URL, or a
    base64 data URL.
    """

    image_ref: str


@router.post("/analyze", response_model=AnalyzeResult)
def analyze_meal(body: AnalyzeRequest) -> AnalyzeResult:
    """Stub vision pipeline. Returns canned detections + a four-stage
    trace identical to what the frontend's mock currently emits.

    Real Gemini wiring (cut b) replaces only the `detected = ...` line.
    The contract — request shape, response shape, trace stages — stays
    exactly as it is.
    """
    pipeline: list[PipelineTrace] = [
        trace("cache-check", "Cache check", "cache-hit"),
        trace("vision-id", "Vision ID (Gemini)", "done"),
        trace("hf-validate", "HF validator", "done"),
        trace("reconcile", "Confidence-weighted reconcile", "done"),
    ]

    detected = VISION_KEYED_DETECTED.get(body.image_ref)
    if detected is None:
        # If OCR is enabled and `image_ref` looks like a path, try to
        # pull text from it — but we don't have a real OCR→detected
        # mapper in cut (a), so this just logs through and returns empty.
        if ocr.is_enabled():
            ocr.extract_text(body.image_ref)  # no-op on miss for now
        return AnalyzeResult(detected=[], pipeline=pipeline)

    # Deep-clone the canned list so callers can't mutate the seed.
    return AnalyzeResult(
        detected=[d.model_copy(deep=True) for d in detected],
        pipeline=pipeline,
    )


# Re-exported for test fixtures.
__all__ = ["router", "AnalyzeRequest", "AnalyzeResult"]