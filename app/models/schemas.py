"""Pydantic v2 schemas — 1:1 mirror of `src/types/schemas.ts`.

Lockstep rule (from `NutriVision_AI_Blueprint.md` §8):
    Any backend schema change requires the matching TS interface in
    `src/types/schemas.ts` to update in the same commit, and vice
    versa. Treat schema drift as a breaking change.

Field naming: the frontend already uses snake_case (`daily_kcal_target`,
`active_goals`, `meal_logged`), so this module is a direct port. No
alias gymnastics needed for the common case.

Where the TS surface uses inline shapes that aren't named (e.g.
`getTodaySummary()`'s return type), we lift them into named models
here (`TodaySummary`) so the FastAPI response_model is explicit.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────
# Core nutrition primitives
# ─────────────────────────────────────────────────────────────────────────


class NutritionFacts(BaseModel):
    """Per-100g macro/micro nutrient facts for a single food item."""

    protein: float
    carbs: float
    fat: float
    kcal: float
    fiber: float
    sodium: float
    sugar: float
    """Glycemic share, 0–1 (used by personalize filter)."""
    glycemic: float


FoodCategory = Literal["protein", "produce", "grains", "other"]


class FoodDescriptor(NutritionFacts):
    """A single food with display metadata + per-100g nutrition."""

    emoji: str
    category: FoodCategory
    """Alternative names the vision model may also emit."""
    alternatives: list[str]
    """Pairings the grocery list may suggest."""
    pairings: list[str]


# ─────────────────────────────────────────────────────────────────────────
# Vision pipeline outputs
# ─────────────────────────────────────────────────────────────────────────


# `bbox` is a fixed-length 4-tuple of normalized [x, y, w, h] floats.
BBox = tuple[float, float, float, float]


class DetectedItem(BaseModel):
    """One food item detected by the dual vision pipeline (Gemini + HF
    validator) before nutrition is resolved."""

    name: str
    """Confidence 0–100; <70 is flagged low-confidence."""
    confidence: float
    """Estimated portion size in grams."""
    grams: float
    """Optional user-facing note (e.g. 'Low confidence — tap to confirm')."""
    note: str | None = None
    """Optional bounding box from the vision model [x, y, w, h] in 0–1
    normalized coordinates."""
    bbox: BBox | None = None

    @field_validator("bbox")
    @classmethod
    def _bbox_length(cls, v: BBox | None) -> BBox | None:
        """Reject malformed bounding boxes (anything other than 4 floats)."""
        if v is not None and len(v) != 4:
            raise ValueError("bbox must be exactly 4 floats: (x, y, w, h)")
        return v


class ResolvedItem(DetectedItem):
    """A `DetectedItem` after passing through the nutrition DB cascade."""

    nutrition: NutritionFacts | None = None
    descriptor: FoodDescriptor | None = None
    """Which DB resolved this item (for explainability)."""
    source: Literal[
        "open-food-facts", "usda", "fruityvice", "cache", "estimated"
    ]
    """True if the resolver only matched an 'estimated' entry."""
    partial: bool = False


# Pipeline stage + status mirrors the TS `PipelineTrace['stage'|'status']`
# literals exactly — these are also used by the frontend CaptureScreen
# toast to label each stage.
PipelineStage = Literal[
    "capture",
    "cache-check",
    "vision-id",
    "hf-validate",
    "reconcile",
    "nutrition",
    "portion",
    "personalize",
    "explain",
]
PipelineStatus = Literal[
    "pending", "running", "done", "cache-hit", "fallback"
]


class PipelineTrace(BaseModel):
    """A pipeline trace entry surfaced in a tiny toast during analysis.
    Proves the multi-stage architecture is real, not just a stub."""

    stage: PipelineStage
    status: PipelineStatus
    started_at: int
    """Wall-clock ms; matches `finishedAt` field in the TS interface."""
    finished_at: int | None = None
    label: str

    # Allow the snake_case ↔ camelCase aliases so older payloads still
    # parse while we migrate call sites. Both forms are accepted.
    model_config = ConfigDict(populate_by_name=True)


class AnalyzeResult(BaseModel):
    detected: list[DetectedItem]
    pipeline: list[PipelineTrace]


class NutrientContribution(BaseModel):
    nutrient: Literal[
        "sodium", "sugar", "fiber", "protein", "carbs", "fat", "kcal"
    ]
    item_name: str
    amount: float
    """Share of total in this nutrient (0–1)."""
    share: float
    flagged: bool
    reason: str | None = None
    """Visual tone for the verdict chip."""
    tone: Literal["good", "warn"] | None = None


class ResolveNutritionResult(BaseModel):
    resolved: list[ResolvedItem]
    contributions: list[NutrientContribution]


# ─────────────────────────────────────────────────────────────────────────
# User profile / personalization
# ─────────────────────────────────────────────────────────────────────────


class HealthGoals(BaseModel):
    diabetic: bool = False
    protein: bool = False
    budget: bool = False
    mediter: bool = False


DietaryPreference = Literal[
    "Vegetarian",
    "Vegan",
    "Pescatarian",
    "Gluten-free",
    "Dairy-free",
    "Halal",
    "Kosher",
]

Allergen = Literal[
    "Peanuts",
    "Tree nuts",
    "Shell shellfish",
    "Soy",
    "Eggs",
    "Dairy",
    "Gluten",
    "Sesame",
]


class UserProfile(BaseModel):
    name: str
    goals: HealthGoals
    preferences: list[DietaryPreference]
    allergens: list[Allergen]
    """Daily grocery budget ceiling, in local currency (BDT)."""
    budget: float
    """Number of people the meal serves."""
    serving: int
    """Daily kcal target for the Home progress bar. Optional — older
    profiles that pre-date this field will fall back to the universal
    default (`DAILY_KCAL_TARGET_DEFAULT`)."""
    daily_kcal_target: float | None = Field(default=None, alias="dailyKcalTarget")

    model_config = ConfigDict(populate_by_name=True)


# Universal fallback daily kcal target (mirrors the TS module constant).
DAILY_KCAL_TARGET_DEFAULT: float = 2000


# ─────────────────────────────────────────────────────────────────────────
# Grocery list
# ─────────────────────────────────────────────────────────────────────────


class GroceryItem(BaseModel):
    id: str
    name: str
    """Per-unit price in BDT."""
    price: float
    checked: bool = False


class GroceryGroup(BaseModel):
    category: str
    items: list[GroceryItem]


class GroceryList(BaseModel):
    budget: float
    groups: list[GroceryGroup]


# ─────────────────────────────────────────────────────────────────────────
# Meal history + aggregates
# ─────────────────────────────────────────────────────────────────────────


class MealTotals(BaseModel):
    """Snapshot of nutrition totals (kcal, protein, carbs, fat, fiber,
    sodium, sugar) for a logged meal."""

    kcal: float
    protein: float
    carbs: float
    fat: float
    fiber: float
    sodium: float
    sugar: float


class MealEntry(BaseModel):
    """A single logged meal stored in history."""

    id: str
    """ISO 8601 timestamp."""
    date: str
    """Auto-generated meal label."""
    label: str
    items: list[DetectedItem]
    totals: MealTotals
    photo_url: str | None = Field(default=None, alias="photoUrl")
    """Which profile goals were active when this meal was logged."""
    active_goals: HealthGoals

    model_config = ConfigDict(populate_by_name=True)


class UserStats(BaseModel):
    total_meals: int
    total_days_active: int
    avg_daily_kcal: int
    streak_days: int


# Lifted from `getTodaySummary()`'s inline return type in the frontend
# so FastAPI has an explicit response_model.
class TodaySummary(BaseModel):
    meals_logged: int
    total_kcal: float
    total_protein: float
    total_carbs: float
    total_fat: float
    daily_kcal_target: float


# ─────────────────────────────────────────────────────────────────────────
# Targets — daily nutrient ceilings used by the personalize filter.
# Matches `MOCK_TARGETS` in `src/mocks/fixtures.ts`.
# ─────────────────────────────────────────────────────────────────────────


class MacroTargets(BaseModel):
    sodium: float
    sugar: float
    fiber: float
    protein: float
    carbs: float
    fat: float
    kcal: float
