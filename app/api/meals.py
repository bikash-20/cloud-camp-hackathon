"""Meal history CRUD + aggregates — mirrors `src/lib/api.ts#saveMeal`,
`getMealHistory`, `getTodaySummary`, `getUserStats`, `deleteMeal`.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.models.schemas import (
    DetectedItem,
    HealthGoals,
    MealEntry,
    MealTotals,
    TodaySummary,
    UserStats,
)
from app.services.state import State, get_state
from app.services.targets import resolve_daily_kcal_target


router = APIRouter(prefix="/api/meals", tags=["meals"])


# ── Request bodies ──────────────────────────────────────────────────────


class SaveMealRequest(BaseModel):
    """Body for `POST /api/meals`. Mirrors the frontend's
    `Omit<MealEntry, 'id' | 'date'>` shape — the backend assigns both."""

    label: str
    items: list[DetectedItem]
    totals: MealTotals
    photo_url: str | None = None
    active_goals: HealthGoals


# ── Endpoints ────────────────────────────────────────────────────────────


@router.post("", response_model=MealEntry, status_code=status.HTTP_201_CREATED)
def save_meal(
    body: SaveMealRequest,
    state: State = Depends(get_state),
) -> MealEntry:
    """Append a new meal entry. `id` and `date` are assigned server-side
    so clients can't forge them."""
    return state.add_meal(
        label=body.label,
        items=body.items,
        totals=body.totals,
        photo_url=body.photo_url,
        active_goals=body.active_goals,
    )


@router.get("", response_model=list[MealEntry])
def get_meal_history(state: State = Depends(get_state)) -> list[MealEntry]:
    """Return the full meal history, newest first. Matches the
    frontend's `getMealHistory()` shape exactly."""
    return state.list_meals()


@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal(
    meal_id: str,
    state: State = Depends(get_state),
) -> None:
    try:
        state.delete_meal(meal_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/today", response_model=TodaySummary)
def get_today_summary(state: State = Depends(get_state)) -> TodaySummary:
    """Aggregate today's meals. The frontend consumes this on the Home
    screen to render the kcal progress bar without loading the full
    profile separately — so we resolve the daily target from the
    currently-loaded profile."""
    meals = state.list_meals()
    today_prefix = datetime.now(timezone.utc).date().isoformat()
    today = [m for m in meals if m.date.startswith(today_prefix)]
    return TodaySummary(
        meals_logged=len(today),
        total_kcal=sum(m.totals.kcal for m in today),
        total_protein=sum(m.totals.protein for m in today),
        total_carbs=sum(m.totals.carbs for m in today),
        total_fat=sum(m.totals.fat for m in today),
        daily_kcal_target=resolve_daily_kcal_target(state.get_profile()),
    )


@router.get("/stats", response_model=UserStats)
def get_user_stats(state: State = Depends(get_state)) -> UserStats:
    """Aggregate user-level stats for the Profile screen. Mirrors the
    frontend's `getUserStats()` exactly — including the simplified
    `streakDays == totalDaysActive` rule (good enough for the demo)."""
    meals = state.list_meals()
    if not meals:
        return UserStats(
            total_meals=0, total_days_active=0, avg_daily_kcal=0, streak_days=0
        )
    days = {m.date[:10] for m in meals}
    total_kcal = sum(m.totals.kcal for m in meals)
    return UserStats(
        total_meals=len(meals),
        total_days_active=len(days),
        avg_daily_kcal=round(total_kcal / len(days)),
        streak_days=len(days),
    )