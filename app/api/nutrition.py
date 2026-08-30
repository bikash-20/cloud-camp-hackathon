"""Nutrition resolver + macro targets endpoint.

Mirrors `src/lib/api.ts#resolveNutrition` and
`src/lib/api.ts#getMacroTargets`.

Cut (a) lookups:
    1. seeded `NUTRITION_DB` (matches frontend `MOCK_NUTRITION_DB`)
    2. Open Food Facts via the live HTTP client in
       `app/services/off_client.py`
    3. → `ResolvedItem(nutrition=None, source='estimated', partial=True)`
       on miss

Cut (b) inserts USDA → Fruityvice steps between (2) and (3).
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.personalize import compute_contributions, resolve_detected_item
from app.models.schemas import (
    DetectedItem,
    MacroTargets,
    ResolveNutritionResult,
    UserProfile,
)
from app.seed.fixtures import TARGETS as DEFAULT_TARGETS
from app.services import off_client as off_client_mod
from app.services.off_client import OFFClient


router = APIRouter(prefix="/api/nutrition", tags=["nutrition"])


# Process-wide OFF client. Lazy-instantiated so tests that never hit
# nutrition can avoid pulling the httpx client at import time.
_off: OFFClient | None = None


def _get_off() -> OFFClient:
    global _off
    if _off is None:
        _off = OFFClient()
    return _off


def _reset_off_for_tests() -> None:
    """Drop the cached OFF client so the next call recreates it with
    whatever env vars are in scope. Test-only — do not call from prod."""
    global _off
    if _off is not None:
        _off.close()
    _off = None


class ResolveRequest(BaseModel):
    """Request body for `POST /api/nutrition/resolve`.

    Wrapped in an object (rather than a bare array) so the optional
    `profile` field has a stable position. FastAPI would otherwise
    require both fields as top-level keys when the second parameter
    is annotated, leading to a confusing 422 on valid inputs.
    """

    items: list[DetectedItem]
    profile: UserProfile | None = None


@router.post("/resolve", response_model=ResolveNutritionResult)
def resolve_nutrition(body: ResolveRequest) -> ResolveNutritionResult:
    """Run the OFF cascade for `body.items`, then compute per-nutrient
    contributions for the explainability panel.

    `profile` is optional — when omitted, no contributions are emitted
    (the frontend uses a default profile for the demo path anyway).
    """
    off = _get_off()
    resolved = [resolve_detected_item(it, off.lookup) for it in body.items]
    contributions = compute_contributions(resolved, body.profile)
    return ResolveNutritionResult(resolved=resolved, contributions=contributions)


@router.get("/targets", response_model=MacroTargets)
def macro_targets() -> MacroTargets:
    """Daily macro ceilings used by NutrientsScreen. Static for now —
    cut (b) will let these vary by profile (e.g. higher protein when
    `goals.protein` is on)."""
    return DEFAULT_TARGETS


# Re-exported so tests can stub the OFF client without reaching into
# private state.
__all__ = ["router", "resolve_nutrition", "macro_targets", "_get_off", "off_client_mod"]
