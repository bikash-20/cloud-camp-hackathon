"""Nutrition resolver + macro targets endpoint.

Mirrors `src/lib/api.ts#resolveNutrition` and
`src/lib/api.ts#getMacroTargets`.

Cascade (cut b):
    1. seeded `NUTRITION_DB` (matches frontend `MOCK_NUTRITION_DB`)
    2. Open Food Facts (already wired in cut a) via `OFFClient`
    3. USDA FoodData Central via `USDAClient` (DEMO_KEY default)
    4. Fruityvice via `FruityviceClient` (no key, fruit-only)
    5. → `ResolvedItem(nutrition=None, source='estimated', partial=True)`
       on miss

The cascade is exposed via `resolve_with_cascade()` — a pure function
that takes name → facts callables for OFF / USDA / Fruityvice so tests
can stub each layer without monkeypatching the live clients.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.personalize import compute_contributions, resolve_detected_item
from app.models.schemas import (
    DetectedItem,
    MacroTargets,
    NutritionFacts,
    ResolveNutritionResult,
    ResolvedItem,
    UserProfile,
)
from app.seed.fixtures import NUTRITION_DB
from app.seed.fixtures import TARGETS as DEFAULT_TARGETS
from app.services import off_client as off_client_mod
from app.services import fruityvice_client as fruityvice_client_mod
from app.services import usda_client as usda_client_mod
from app.services.fruityvice_client import FruityviceClient
from app.services.off_client import OFFClient
from app.services.usda_client import USDAClient


router = APIRouter(prefix="/api/nutrition", tags=["nutrition"])


# Process-wide clients. Lazy-instantiated so tests that never hit
# nutrition can avoid pulling httpx at import time.
_off: OFFClient | None = None
_usda: USDAClient | None = None
_fruityvice: FruityviceClient | None = None


def _get_off() -> OFFClient:
    global _off
    if _off is None:
        _off = OFFClient()
    return _off


def _get_usda() -> USDAClient:
    global _usda
    if _usda is None:
        _usda = USDAClient()
    return _usda


def _get_fruityvice() -> FruityviceClient:
    global _fruityvice
    if _fruityvice is None:
        _fruityvice = FruityviceClient()
    return _fruityvice


def _reset_clients_for_tests() -> None:
    """Drop the cached clients so the next call recreates them with
    whatever env vars are in scope. Test-only — do not call from prod."""
    global _off, _usda, _fruityvice
    if _off is not None:
        _off.close()
    if _usda is not None:
        _usda.close()
    if _fruityvice is not None:
        _fruityvice.close()
    _off = _usda = _fruityvice = None


# Back-compat alias so existing test fixtures keep working.
_reset_off_for_tests = _reset_clients_for_tests


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
    """Run the OFF → USDA → Fruityvice cascade for `body.items`, then
    compute per-nutrient contributions for the explainability panel.

    `profile` is optional — when omitted, no contributions are emitted
    (the frontend uses a default profile for the demo path anyway).
    """
    resolved = [
        resolve_with_cascade(
            it,
            off_facts=_get_off().lookup,
            usda_facts=_get_usda().lookup,
            fruityvice_facts=_get_fruityvice().lookup,
        )
        for it in body.items
    ]
    contributions = compute_contributions(resolved, body.profile)
    return ResolveNutritionResult(resolved=resolved, contributions=contributions)


@router.get("/targets", response_model=MacroTargets)
def macro_targets() -> MacroTargets:
    """Daily macro ceilings used by NutrientsScreen. Static for now —
    cut (b) will let these vary by profile (e.g. higher protein when
    `goals.protein` is on)."""
    return DEFAULT_TARGETS


def resolve_with_cascade(
    item: DetectedItem,
    *,
    off_facts,
    usda_facts,
    fruityvice_facts,
) -> ResolvedItem:
    """Cascade resolver — try each source in order, fall through on miss.

    Pure function w.r.t. its lookup callbacks (they're injectable so
    tests can stub each layer). The live clients are passed in by the
    route handler via `_get_*()` accessors.
    """
    # 1. Seeded cache (matches frontend's MOCK_NUTRITION_DB).
    if (descriptor := NUTRITION_DB.get(item.name)) is not None:
        return ResolvedItem(
            **item.model_dump(),
            nutrition=descriptor,
            descriptor=descriptor,
            source="cache",
            partial=False,
        )
    # 2. OFF live.
    if (facts := _safe_lookup(off_facts, item.name)) is not None:
        return ResolvedItem(
            **item.model_dump(),
            nutrition=facts,
            descriptor=None,
            source="open-food-facts",
            partial=False,
        )
    # 3. USDA live (DEMO_KEY works without signup).
    if (facts := _safe_lookup(usda_facts, item.name)) is not None:
        return ResolvedItem(
            **item.model_dump(),
            nutrition=facts,
            descriptor=None,
            source="usda",
            partial=False,
        )
    # 4. Fruityvice (fruit-only; cheap no-key API).
    if (facts := _safe_lookup(fruityvice_facts, item.name)) is not None:
        return ResolvedItem(
            **item.model_dump(),
            nutrition=facts,
            descriptor=None,
            source="fruityvice",
            partial=False,
        )
    # 5. Estimated fallback — partial=True signals to the UI that the
    #    nutrition is best-effort and flagging shouldn't fire.
    return ResolvedItem(
        **item.model_dump(),
        nutrition=None,
        descriptor=None,
        source="estimated",
        partial=True,
    )


def _safe_lookup(lookup, name: str) -> NutritionFacts | None:
    """Call a cascade lookup and swallow any exception — the cascade
    must always fall through to the next step rather than 500."""
    try:
        return lookup(name)
    except Exception:
        return None


# Re-exported so tests can stub the live clients without reaching into
# private state.
__all__ = [
    "router",
    "resolve_nutrition",
    "macro_targets",
    "resolve_with_cascade",
    "_get_off",
    "_get_usda",
    "_get_fruityvice",
    "_reset_clients_for_tests",
    "off_client_mod",
    "usda_client_mod",
    "fruityvice_client_mod",
]
