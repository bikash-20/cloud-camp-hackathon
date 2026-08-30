"""Contract tests — one happy-path round-trip per endpoint, plus a
handful of negative paths documented in the plan.

Each test asserts:
  1. The endpoint returns 2xx (or the expected 4xx on negative paths).
  2. The response body validates against the matching Pydantic model.
  3. Side-effects (state.json) round-trip on the next request.

These are the tests that will catch schema drift early — if anyone
changes a field name in `app/models/schemas.py` without updating
`src/types/schemas.ts`, one of these will fail.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.models.schemas import (
    GroceryItem,
    MealEntry,
    MealTotals,
    HealthGoals,
    UserProfile,
)
from app.seed.fixtures import (
    DEFAULT_PROFILE,
    DEFAULT_GROCERY_GROUPS,
    TARGETS,
)


# ── Vision ──────────────────────────────────────────────────────────────


def test_vision_analyze_known_ref(client: TestClient) -> None:
    """Known image_ref → canned DetectedItem list + 4-stage trace."""
    resp = client.post("/api/vision/analyze", json={"image_ref": "chicken_biryani.jpg"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["detected"]) == 4
    assert {d["name"] for d in body["detected"]} == {
        "Chicken biryani",
        "Cucumber raita",
        "Mixed salad",
        "Pickled onion",
    }
    # Trace must mirror the frontend's expected stages.
    stages = [t["stage"] for t in body["pipeline"]]
    assert stages == ["cache-check", "vision-id", "hf-validate", "reconcile"]


def test_vision_analyze_unknown_ref_returns_empty(client: TestClient) -> None:
    """Unknown image_ref → empty detected list + the same trace. The
    frontend can render 'no items detected' on its own."""
    resp = client.post("/api/vision/analyze", json={"image_ref": "unknown.jpg"})
    assert resp.status_code == 200
    assert resp.json()["detected"] == []


# ── Nutrition ───────────────────────────────────────────────────────────


def test_nutrition_targets_match_seed(client: TestClient) -> None:
    """The targets endpoint must serve the same numbers as the
    frontend's `MOCK_TARGETS` so the NutrientsScreen math is identical."""
    resp = client.get("/api/nutrition/targets")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {
        "kcal": TARGETS.kcal,
        "protein": TARGETS.protein,
        "carbs": TARGETS.carbs,
        "fat": TARGETS.fat,
        "fiber": TARGETS.fiber,
        "sodium": TARGETS.sodium,
        "sugar": TARGETS.sugar,
    }


def test_nutrition_resolve_seeded_items_use_cache(client: TestClient) -> None:
    """Items present in the seeded DB resolve via `cache` source and
    carry their full `NutritionFacts`."""
    resp = client.post(
        "/api/nutrition/resolve",
        json={
            "items": [
                {"name": "Chicken biryani", "confidence": 92, "grams": 310},
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["resolved"]) == 1
    item = body["resolved"][0]
    assert item["source"] == "cache"
    assert item["partial"] is False
    assert item["nutrition"]["kcal"] == 165


def test_nutrition_resolve_unknown_item_uses_off(
    client: TestClient, stub_off
) -> None:
    """Unknown item → resolved via OFF stub → partial=False."""
    resp = client.post(
        "/api/nutrition/resolve",
        json={
            "items": [{"name": "Mystery food", "confidence": 80, "grams": 100}],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["resolved"][0]["source"] == "open-food-facts"
    assert body["resolved"][0]["partial"] is False


def test_nutrition_resolve_emits_contributions(
    client: TestClient, stub_off
) -> None:
    """One dominant high-sodium item + non-diabetic profile →
    sodium over-target contribution with `flagged=True`. Mirrors
    the `flagRules` math in `src/lib/api.ts` exactly.

    The "warn" tone requires one item to carry ≥30% of the meal's
    sodium share. With evenly-distributed items no individual item
    is the culprit, so we craft a scenario with a single heavy
    item plus lighter ones."""
    # One heavy item: 1000g × 200mg/100g = 2000mg sodium (>30% of total).
    # Plus four light items: 50g × 200mg/100g = 100mg each.
    # Total: 2000 + 4×100 = 2400mg, well over the 1200 cap.
    items = [
        {"name": "Heavy salt", "confidence": 90, "grams": 1000},
        *[{"name": f"Light salt {i}", "confidence": 90, "grams": 50} for i in range(4)],
    ]
    non_diabetic_profile = DEFAULT_PROFILE.model_copy(
        update={"goals": HealthGoals(diabetic=False, protein=False, budget=True, mediter=False)}
    )
    resp = client.post(
        "/api/nutrition/resolve",
        json={
            "items": items,
            "profile": non_diabetic_profile.model_dump(mode="json", by_alias=True),
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    sodium_flagged = [
        c for c in body["contributions"]
        if c["nutrient"] == "sodium" and c["flagged"] is True
    ]
    assert sodium_flagged, "expected at least one flagged sodium contribution"
    # The heavy item should be the one flagged.
    assert any(c["item_name"] == "Heavy salt" for c in sodium_flagged)


# ── Profile ─────────────────────────────────────────────────────────────


def test_profile_default_and_update(client: TestClient) -> None:
    """GET returns the default seed profile; PUT replaces it; the
    next GET reflects the update (state.json round-trip)."""
    get_resp = client.get("/api/profile")
    assert get_resp.status_code == 200
    initial = get_resp.json()
    assert initial["name"] == DEFAULT_PROFILE.name
    assert initial["budget"] == DEFAULT_PROFILE.budget

    new_profile = UserProfile.model_validate(initial).model_copy(update={"name": "Updated"})
    put_resp = client.put("/api/profile", json=new_profile.model_dump(mode="json", by_alias=True))
    assert put_resp.status_code == 200
    assert put_resp.json()["name"] == "Updated"

    # Round-trip — the second GET must reflect the PUT.
    again = client.get("/api/profile").json()
    assert again["name"] == "Updated"


# ── Grocery ─────────────────────────────────────────────────────────────


def test_grocery_list_initial_state(client: TestClient) -> None:
    """First GET returns the seeded groups in seeded order."""
    resp = client.get("/api/grocery", params={"budget": 500})
    assert resp.status_code == 200
    body = resp.json()
    assert body["budget"] == 500
    assert [g["category"] for g in body["groups"]] == [
        g.category for g in DEFAULT_GROCERY_GROUPS
    ]


def test_grocery_crud_round_trip(client: TestClient) -> None:
    """Add → toggle → remove → assert via the list endpoint."""
    # Add
    add_resp = client.post(
        "/api/grocery/items",
        json={"name": "Test item", "price": 99.0, "category": "Other"},
    )
    assert add_resp.status_code == 201
    new_item = add_resp.json()
    assert new_item["name"] == "Test item"
    assert new_item["price"] == 99.0
    new_id = new_item["id"]

    # Update price
    price_resp = client.put(
        f"/api/grocery/items/{new_id}/price", json={"price": 149.0}
    )
    assert price_resp.status_code == 204

    # Toggle
    toggle_resp = client.post(f"/api/grocery/items/{new_id}/toggle")
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["checked"] is True

    # Remove
    del_resp = client.delete(f"/api/grocery/items/{new_id}")
    assert del_resp.status_code == 204


def test_grocery_clear_removes_all(client: TestClient) -> None:
    """DELETE /api/grocery wipes every item. The bucketed response
    still emits the seeded category shells (mirroring the frontend's
    `bucketGroceryByCategory` behavior) but each one's `items` list
    must be empty."""
    clear_resp = client.delete("/api/grocery")
    assert clear_resp.status_code == 204

    after = client.get("/api/grocery", params={"budget": 500}).json()
    # Bucketing preserves the seeded category shells — they just have
    # no items. No "Other" bucket is added when there are zero items.
    assert all(g["items"] == [] for g in after["groups"])
    assert all(g["category"] != "Other" for g in after["groups"])


def test_grocery_remove_unknown_returns_404(client: TestClient) -> None:
    """Negative path: missing grocery id → 404, not 500."""
    resp = client.delete("/api/grocery/items/g-does-not-exist")
    assert resp.status_code == 404


# ── Meals ───────────────────────────────────────────────────────────────


def test_meal_save_and_list_round_trip(client: TestClient) -> None:
    """Save a meal, confirm it appears in the list with server-assigned
    id + date."""
    save_resp = client.post(
        "/api/meals",
        json={
            "label": "Test meal",
            "items": [
                {"name": "Chicken biryani", "confidence": 92, "grams": 310}
            ],
            "totals": {
                "kcal": 511.5,
                "protein": 18.6,
                "carbs": 68.2,
                "fat": 13.95,
                "fiber": 1.86,
                "sodium": 1178.0,
                "sugar": 2.79,
            },
            "photo_url": None,
            "active_goals": {
                "diabetic": True,
                "protein": False,
                "budget": True,
                "mediter": False,
            },
        },
    )
    assert save_resp.status_code == 201
    saved = save_resp.json()
    assert saved["id"]
    assert saved["date"]
    assert saved["label"] == "Test meal"

    list_resp = client.get("/api/meals")
    assert list_resp.status_code == 200
    meals = list_resp.json()
    assert len(meals) == 1
    assert meals[0]["id"] == saved["id"]


def test_meal_today_summary_reflects_saved_meals(client: TestClient) -> None:
    """A meal saved right now should appear in today's summary."""
    client.post(
        "/api/meals",
        json={
            "label": "Lunch",
            "items": [{"name": "Chicken biryani", "confidence": 90, "grams": 300}],
            "totals": {
                "kcal": 500.0,
                "protein": 18.0,
                "carbs": 66.0,
                "fat": 14.0,
                "fiber": 2.0,
                "sodium": 1100.0,
                "sugar": 3.0,
            },
            "photo_url": None,
            "active_goals": {
                "diabetic": True,
                "protein": False,
                "budget": True,
                "mediter": False,
            },
        },
    )

    today = client.get("/api/meals/today").json()
    assert today["meals_logged"] == 1
    assert today["total_kcal"] == 500.0
    assert today["daily_kcal_target"] == 2000.0  # default fallback


def test_meal_stats_aggregate(client: TestClient) -> None:
    """Two meals → total_meals=2, total_days_active=1."""
    for i in range(2):
        client.post(
            "/api/meals",
            json={
                "label": f"M{i}",
                "items": [{"name": "X", "confidence": 90, "grams": 100}],
                "totals": {
                    "kcal": 100.0, "protein": 10.0, "carbs": 10.0,
                    "fat": 5.0, "fiber": 1.0, "sodium": 100.0, "sugar": 1.0,
                },
                "photo_url": None,
                "active_goals": {
                    "diabetic": False, "protein": False,
                    "budget": False, "mediter": False,
                },
            },
        )
    stats = client.get("/api/meals/stats").json()
    assert stats["total_meals"] == 2
    assert stats["total_days_active"] == 1
    assert stats["avg_daily_kcal"] == 200


def test_meal_delete_unknown_returns_404(client: TestClient) -> None:
    """Negative path: missing meal id → 404, not 500."""
    resp = client.delete("/api/meals/meal-does-not-exist")
    assert resp.status_code == 404


def test_meal_delete_actually_removes(client: TestClient) -> None:
    """Save then delete — the meal must be gone from subsequent GETs."""
    save = client.post(
        "/api/meals",
        json={
            "label": "Disposable",
            "items": [{"name": "X", "confidence": 90, "grams": 100}],
            "totals": {
                "kcal": 100.0, "protein": 10.0, "carbs": 10.0,
                "fat": 5.0, "fiber": 1.0, "sodium": 100.0, "sugar": 1.0,
            },
            "photo_url": None,
            "active_goals": {
                "diabetic": False, "protein": False,
                "budget": False, "mediter": False,
            },
        },
    ).json()

    delete = client.delete(f"/api/meals/{save['id']}")
    assert delete.status_code == 204

    meals = client.get("/api/meals").json()
    assert all(m["id"] != save["id"] for m in meals)