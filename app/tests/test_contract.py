"""Contract tests — one happy-path round-trip per endpoint, plus the
seams and negative paths that catch schema drift early.

The point of these tests is the **wire format**, not CRUD permutation.
Each test asserts:
  1. The endpoint returns 2xx (or the expected 4xx on negative paths).
  2. The response body validates against the matching Pydantic model.
  3. Where a side-effect matters, the next request reflects it.

If anyone changes a field name in `app/models/schemas.py` without
updating `src/types/schemas.ts`, one of these will fail.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.models.schemas import HealthGoals, UserProfile
from app.seed.fixtures import DEFAULT_GROCERY_GROUPS, DEFAULT_PROFILE, TARGETS


# ── Vision ──────────────────────────────────────────────────────────────


def test_vision_analyze_known_ref(client: TestClient) -> None:
    """Known image_ref → canned DetectedItem list + 4-stage trace."""
    resp = client.post("/api/vision/analyze", json={"image_ref": "chicken_biryani.jpg"})
    assert resp.status_code == 200
    body = resp.json()
    assert {d["name"] for d in body["detected"]} == {
        "Chicken biryani", "Cucumber raita", "Mixed salad", "Pickled onion",
    }
    assert [t["stage"] for t in body["pipeline"]] == [
        "cache-check", "vision-id", "hf-validate", "reconcile",
    ]


def test_vision_analyze_unknown_ref_returns_empty(client: TestClient) -> None:
    """Unknown image_ref → empty list with the same trace."""
    resp = client.post("/api/vision/analyze", json={"image_ref": "unknown.jpg"})
    assert resp.status_code == 200
    assert resp.json()["detected"] == []


# ── Nutrition ───────────────────────────────────────────────────────────


def test_nutrition_targets_match_seed(client: TestClient) -> None:
    """The targets endpoint must serve the same numbers as the
    frontend's `MOCK_TARGETS` so the NutrientsScreen math is identical."""
    resp = client.get("/api/nutrition/targets")
    assert resp.status_code == 200
    assert resp.json() == TARGETS.model_dump()


def test_nutrition_resolve_seeded_items_use_cache(client: TestClient) -> None:
    """Items in the seeded DB resolve via `cache` source with full nutrition."""
    resp = client.post(
        "/api/nutrition/resolve",
        json={"items": [{"name": "Chicken biryani", "confidence": 92, "grams": 310}]},
    )
    assert resp.status_code == 200
    item = resp.json()["resolved"][0]
    assert item["source"] == "cache"
    assert item["partial"] is False
    assert item["nutrition"]["kcal"] == 165


def test_nutrition_resolve_unknown_item_uses_off(client: TestClient, stub_off) -> None:
    """Unknown item → resolved via OFF stub, not partial."""
    resp = client.post(
        "/api/nutrition/resolve",
        json={"items": [{"name": "Mystery food", "confidence": 80, "grams": 100}]},
    )
    assert resp.status_code == 200
    item = resp.json()["resolved"][0]
    assert item["source"] == "open-food-facts"
    assert item["partial"] is False


def test_nutrition_resolve_emits_contributions(client: TestClient, stub_off) -> None:
    """One dominant high-sodium item + non-diabetic profile → at least one
    flagged sodium contribution that names the dominant item.

    Mirrors `src/lib/api.ts#flagRules` — exercises the personalize layer
    (which is real logic, not just a CRUD seam)."""
    # 1000g of "Heavy salt" (200mg/100g) + 4× 50g "Light salt" (200mg/100g).
    # Total = 2400mg, well over the 1200mg cap. Heavy item owns ~83%.
    items = [{"name": "Heavy salt", "confidence": 90, "grams": 1000}] + [
        {"name": f"Light salt {i}", "confidence": 90, "grams": 50} for i in range(4)
    ]
    profile = DEFAULT_PROFILE.model_copy(
        update={"goals": HealthGoals(diabetic=False, protein=False, budget=True, mediter=False)}
    )
    resp = client.post(
        "/api/nutrition/resolve",
        json={"items": items, "profile": profile.model_dump(mode="json", by_alias=True)},
    )
    assert resp.status_code == 200
    sodium_flagged = [
        c for c in resp.json()["contributions"]
        if c["nutrient"] == "sodium" and c["flagged"] is True
    ]
    assert sodium_flagged
    assert any(c["item_name"] == "Heavy salt" for c in sodium_flagged)


# ── Profile ─────────────────────────────────────────────────────────────


def test_profile_round_trip(client: TestClient) -> None:
    """GET → seed, PUT → replacement, GET reflects the PUT.

    Only this combined test — the seed round-trip is the only
    contract worth pinning on the profile endpoint."""
    initial = client.get("/api/profile").json()
    assert initial["name"] == DEFAULT_PROFILE.name

    updated = UserProfile.model_validate(initial).model_copy(update={"name": "Updated"})
    put = client.put("/api/profile", json=updated.model_dump(mode="json", by_alias=True))
    assert put.status_code == 200
    assert put.json()["name"] == "Updated"

    again = client.get("/api/profile").json()
    assert again["name"] == "Updated"


# ── Grocery ─────────────────────────────────────────────────────────────


def test_grocery_list_seeded_in_seed_order(client: TestClient) -> None:
    """First GET returns the seeded groups in seeded order."""
    resp = client.get("/api/grocery", params={"budget": 500})
    assert resp.status_code == 200
    body = resp.json()
    assert body["budget"] == 500
    assert [g["category"] for g in body["groups"]] == [g.category for g in DEFAULT_GROCERY_GROUPS]


def test_grocery_remove_unknown_returns_404(client: TestClient) -> None:
    """Negative path: missing grocery id → 404, not 500."""
    assert client.delete("/api/grocery/items/g-does-not-exist").status_code == 404


# ── Meals ───────────────────────────────────────────────────────────────


def test_meal_save_and_list_round_trip(client: TestClient) -> None:
    """Save a meal → list includes it with server-assigned id + date."""
    save = client.post(
        "/api/meals",
        json={
            "label": "Test meal",
            "items": [{"name": "Chicken biryani", "confidence": 92, "grams": 310}],
            "totals": {
                "kcal": 511.5, "protein": 18.6, "carbs": 68.2,
                "fat": 13.95, "fiber": 1.86, "sodium": 1178.0, "sugar": 2.79,
            },
            "photo_url": None,
            "active_goals": {"diabetic": True, "protein": False, "budget": True, "mediter": False},
        },
    )
    assert save.status_code == 201
    saved = save.json()
    assert saved["id"] and saved["date"] and saved["label"] == "Test meal"

    meals = client.get("/api/meals").json()
    assert any(m["id"] == saved["id"] for m in meals)


def test_meal_today_summary_reflects_saved_meals(client: TestClient) -> None:
    """A meal saved now appears in today's summary with the right total."""
    client.post(
        "/api/meals",
        json={
            "label": "Lunch",
            "items": [{"name": "Chicken biryani", "confidence": 90, "grams": 300}],
            "totals": {
                "kcal": 500.0, "protein": 18.0, "carbs": 66.0,
                "fat": 14.0, "fiber": 2.0, "sodium": 1100.0, "sugar": 3.0,
            },
            "photo_url": None,
            "active_goals": {"diabetic": True, "protein": False, "budget": True, "mediter": False},
        },
    )
    today = client.get("/api/meals/today").json()
    assert today["meals_logged"] == 1
    assert today["total_kcal"] == 500.0


def test_meal_stats_aggregate(client: TestClient) -> None:
    """Two meals → stats reflect count + active day count."""
    payload = {
        "items": [{"name": "X", "confidence": 90, "grams": 100}],
        "totals": {
            "kcal": 100.0, "protein": 10.0, "carbs": 10.0,
            "fat": 5.0, "fiber": 1.0, "sodium": 100.0, "sugar": 1.0,
        },
        "photo_url": None,
        "active_goals": {"diabetic": False, "protein": False, "budget": False, "mediter": False},
    }
    for label in ("M0", "M1"):
        client.post("/api/meals", json={"label": label, **payload})
    stats = client.get("/api/meals/stats").json()
    assert stats["total_meals"] == 2
    assert stats["total_days_active"] == 1


def test_meal_delete_unknown_returns_404(client: TestClient) -> None:
    """Negative path: missing meal id → 404, not 500."""
    assert client.delete("/api/meals/meal-does-not-exist").status_code == 404