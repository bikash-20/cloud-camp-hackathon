"""Tests for Dietary Pivot Engine & Market Pricing."""

from __future__ import annotations

from app.models.schemas import DetectedItem, HealthGoals, UserProfile
from app.services.pivot_engine import evaluate_dietary_pivots, resolve_market_price


def test_resolve_market_price_returns_authentic_prices():
    chicken = resolve_market_price("Broiler chicken", 1000)
    assert chicken["unit_price_bdt"] == 200.0
    assert chicken["estimated_cost_bdt"] == 200.0

    beef = resolve_market_price("Beef (with bone)", 500)
    assert beef["unit_price_bdt"] == 780.0
    assert beef["estimated_cost_bdt"] == 390.0

    dal = resolve_market_price("Masoor dal (fine)", 250)
    assert dal["unit_price_bdt"] == 150.0
    assert dal["estimated_cost_bdt"] == 38.0


def test_evaluate_dietary_pivots_suggests_brown_rice_swap():
    detected = [
        DetectedItem(name="Steamed white rice", confidence=95, grams=250),
        DetectedItem(name="Chicken curry", confidence=90, grams=180),
    ]
    profile = UserProfile(
        name="Rafi",
        goals=HealthGoals(diabetic=True),
        medical_conditions=["prediabetes"],
    )
    pivots = evaluate_dietary_pivots(detected, profile)
    assert len(pivots) == 1
    assert pivots[0]["id"] == "pivot-rice-glycemic-optimization"
    assert pivots[0]["delta"]["carbs_g"] < 0
    assert pivots[0]["delta"]["fiber_g"] > 0
    assert pivots[0]["glycemic_reduction_pct"] > 30
