"""Daily-kcal-target resolver — backend mirror of the TS shim.

Mirrors `resolveDailyKcalTarget()` in `src/types/schemas.ts`. Older
profiles that pre-date the `daily_kcal_target` field fall back to
the universal default. Always returns a positive finite number.
"""

from __future__ import annotations

import math

from app.models.schemas import DAILY_KCAL_TARGET_DEFAULT, UserProfile


def resolve_daily_kcal_target(profile: UserProfile | None) -> float:
    """Return the effective daily kcal target for a profile, falling
    back to the universal default if absent or invalid."""
    if profile is None:
        return DAILY_KCAL_TARGET_DEFAULT
    v = profile.daily_kcal_target
    if v is None or not math.isfinite(v) or v <= 0:
        return DAILY_KCAL_TARGET_DEFAULT
    return v
