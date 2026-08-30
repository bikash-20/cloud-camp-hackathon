"""Personalize / explainability layer.

Mirrors the `flagRules` block in `src/lib/api.ts#resolveNutrition`
exactly so the NutrientsScreen verdict chips render identical
contributions when wired to the backend. The math is the same;
only the language is Python.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models.schemas import (
    DetectedItem,
    HealthGoals,
    NutrientContribution,
    ResolvedItem,
    UserProfile,
)
from app.seed.fixtures import TARGETS


@dataclass(frozen=True)
class _FlagRule:
    nutrient: str
    threshold: float
    reason_if_high: str
    reason_if_low: str | None
    low_threshold: float | None
    unit: str  # "g" or "mg" — for the high-reason string formatting


# Threshold values come from `app/seed/fixtures.py:TARGETS`. The reason
# strings are templated the same way the frontend does it: the per-item
# amount is interpolated into a sentence that names the food and calls
# out the relevant threshold.
_RULES: list[_FlagRule] = [
    _FlagRule(
        nutrient="sodium",
        threshold=TARGETS.sodium,
        reason_if_high=(
            "{name} adds {amount}mg sodium — that's {pct}% of your daily cap in one item."
        ),
        reason_if_low=None,
        low_threshold=None,
        unit="mg",
    ),
    _FlagRule(
        nutrient="sugar",
        threshold=TARGETS.sugar,
        reason_if_high=(
            "{name} brings {amount}g of sugar — a notable spike for a prediabetic-friendly plate."
        ),
        reason_if_low=(
            "{name} contributes only ~{amount}g of sugar — well within your prediabetic-friendly target."
        ),
        low_threshold=TARGETS.sugar * 0.6,
        unit="g",
    ),
    _FlagRule(
        nutrient="fiber",
        threshold=TARGETS.fiber,
        reason_if_high=(
            "{name} is a solid fiber source at {amount}g — pulls the meal toward target."
        ),
        reason_if_low=(
            "{name} contributes only ~{amount}g fiber — the whole meal falls short of your 30g daily target. Add whole grains or legumes next time."
        ),
        low_threshold=12.0,
        unit="g",
    ),
    _FlagRule(
        nutrient="protein",
        threshold=TARGETS.protein,
        reason_if_high=(
            "{name} delivers {amount}g of protein — strong for a single dish."
        ),
        reason_if_low=(
            "{name} is light on protein (~{amount}g) — consider adding dal or paneer."
        ),
        low_threshold=None,
        unit="g",
    ),
]


def _nutrient_is_flagged_for_profile(rule: _FlagRule, goals: HealthGoals) -> bool:
    """Mirrors the `nutrientIsFlaggedForProfile` check in the frontend.
    Diabetic profiles care about sugar + fiber; everyone else cares
    about sodium + fiber."""
    if goals.diabetic:
        return rule.nutrient in {"sugar", "fiber"}
    return rule.nutrient in {"sodium", "fiber"}


def compute_contributions(
    resolved: list[ResolvedItem],
    profile: UserProfile | None,
) -> list[NutrientContribution]:
    """Compute per-item, per-nutrient contributions for the explainability
    panel. Returns an empty list if no nutrient is in play for the user's
    profile (matches frontend behavior)."""
    if profile is None:
        return []
    # Per-nutrient totals across all resolved items.
    totals: dict[str, float] = {rule.nutrient: 0.0 for rule in _RULES}
    for r in resolved:
        if r.nutrition is None:
            continue
        factor = r.grams / 100.0
        for rule in _RULES:
            totals[rule.nutrient] += getattr(r.nutrition, rule.nutrient) * factor

    contributions: list[NutrientContribution] = []
    for rule in _RULES:
        if not _nutrient_is_flagged_for_profile(rule, profile.goals):
            continue
        total = totals[rule.nutrient]
        meal_over = total > rule.threshold
        meal_under = rule.low_threshold is not None and total < rule.low_threshold
        if not meal_over and not meal_under:
            continue
        for r in resolved:
            if r.nutrition is None:
                continue
            factor = r.grams / 100.0
            amount = getattr(r.nutrition, rule.nutrient) * factor
            share = (amount / total) if total > 0 else 0.0
            if share < 0.10:
                continue
            tone = "warn" if (meal_over and share >= 0.30) else "good"
            if tone == "warn":
                template = rule.reason_if_high
                pct = round((amount / rule.threshold) * 100) if rule.threshold > 0 else 0
                reason = template.format(
                    name=r.name,
                    amount=_format_amount(amount, rule.unit),
                    pct=pct,
                )
            elif rule.reason_if_low is not None:
                reason = rule.reason_if_low.format(
                    name=r.name,
                    amount=_format_amount(amount, rule.unit),
                )
            else:
                continue
            contributions.append(
                NutrientContribution(
                    nutrient=rule.nutrient,  # type: ignore[arg-type]
                    item_name=r.name,
                    amount=amount,
                    share=share,
                    flagged=(tone == "warn"),
                    reason=reason,
                    tone=tone,
                )
            )
    return contributions


def _format_amount(amount: float, unit: str) -> str | float:
    """Format amounts the same way the frontend does: integers for mg,
    one decimal for grams."""
    if unit == "mg":
        return str(round(amount))
    return round(amount, 1)


def resolve_detected_item(item: DetectedItem, off_facts) -> ResolvedItem:
    """Convert a `DetectedItem` into a `ResolvedItem` by joining against
    the seeded `NUTRITION_DB` first, then falling back to Open Food Facts.

    `off_facts` is a callable `(name: str) -> NutritionFacts | None` —
    injected so this layer doesn't depend on the OFF client directly
    (testable in isolation).
    """
    # Imported here to avoid a circular import at module load.
    from app.seed.fixtures import NUTRITION_DB

    descriptor = NUTRITION_DB.get(item.name)
    if descriptor is not None:
        return ResolvedItem(
            **item.model_dump(),
            nutrition=descriptor,
            descriptor=descriptor,
            source="cache",
            partial=False,
        )
    facts = off_facts(item.name)
    if facts is None:
        return ResolvedItem(
            **item.model_dump(),
            nutrition=None,
            descriptor=None,
            source="estimated",
            partial=True,
        )
    return ResolvedItem(
        **item.model_dump(),
        nutrition=facts,
        descriptor=None,
        source="open-food-facts",
        partial=False,
    )
