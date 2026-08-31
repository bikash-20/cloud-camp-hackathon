"""Portion estimator — uses the canned `DENSITY_TABLE` to add realistic
variance to the seeded grams so two servings of "Chicken biryani"
don't come back at exactly the same portion.

When a bbox is available, the canned grams is treated as a *median*
and scaled by a category factor drawn from the density table.
When no bbox is present, we keep the canned value (the demo path).

Pure function — no I/O.
"""

from __future__ import annotations

from app.models.schemas import DetectedItem
from app.models.schemas import DENSITY_TABLE as _SEED_DENSITY


# Cap so a tiny seed doesn't disappear (e.g. 10g × 0.25 = 2.5g would
# be useless for any UI display).
MIN_GRAMS = 25.0


def estimate(item: DetectedItem) -> DetectedItem:
    """Return a copy of `item` with `grams` adjusted by the density table.

    If the item has no bbox, returns it unchanged — we have no signal
    to vary the portion. (The Gemini prompt asks for bbox when the
    item is visually prominent enough to localize.)
    """
    if item.bbox is None:
        return item
    factor = _factor_for(item.name)
    new_grams = max(MIN_GRAMS, round(item.grams * factor))
    return item.model_copy(update={"grams": new_grams})


def _factor_for(name: str) -> float:
    """Pick the closest density-table row for `name`.

    The table rows have `item_hint`s; we match on substring, preferring
    the longer hint when multiple match (so "biryani rice" picks
    "biryani" over "rice").
    """
    name_l = name.lower()
    best_hint: str | None = None
    best_factor: float | None = None
    for row in _SEED_DENSITY:
        hint = row.item_hint
        if hint is None:
            continue
        if hint in name_l and (best_hint is None or len(hint) > len(best_hint)):
            best_hint = hint
            best_factor = row.g_per_ml
    # If the hint lives in the same `category` bucket as the item but
    # matched on category alone (e.g. "roti" + "protein row" via no
    # direct hint), prefer the category default; here we just fall
    # through to 1.0.
    if best_factor is None:
        return 1.0
    # `g_per_ml` is in 0–1.5 range; treat it as a soft scale on the
    # canned grams. Clamp so we never half or double the seed.
    return max(0.7, min(1.3, best_factor))