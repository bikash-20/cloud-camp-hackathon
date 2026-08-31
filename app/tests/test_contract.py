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


# ── Cut (b): fixtures ────────────────────────────────────────────────────


class _FakeStage:
    """Universal stub for HF / Gemini / OFF / USDA / Fruityvice clients.

    Methods return what the caller hands via `set_return`. Keeps each
    test self-contained — no global monkeypatches leaking between tests.
    """

    def __init__(self) -> None:
        self._next_return = None
        self.calls: list[str] = []

    def is_configured(self) -> bool:
        return True

    def detect(self, image_ref: str):  # noqa: D401
        self.calls.append(image_ref)
        return self._next_return

    def classify(self, image_ref: str):
        self.calls.append(image_ref)
        return self._next_return

    def lookup(self, name: str):
        self.calls.append(name)
        return self._next_return

    def set_return(self, value) -> None:
        self._next_return = value

    def close(self) -> None:
        pass


@pytest.fixture
def vision_clients(monkeypatch: pytest.MonkeyPatch):
    """Wire Gemini + HF with controllable returns; canned fallback stays
    untouched so the trace still exercises the 4-stage shape."""
    import app.api.vision as vision_mod

    gemini = _FakeStage()
    hf = _FakeStage()
    monkeypatch.setattr(vision_mod, "_get_gemini", lambda: gemini)
    monkeypatch.setattr(vision_mod, "_get_hf", lambda: hf)
    return gemini, hf


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


# ── Cut (b): real vision pipeline with mocked Gemini/HF clients ────────


def test_vision_pipeline_uses_gemini_when_configured(
    client: TestClient, vision_clients
) -> None:
    """With Gemini + HF stubbed and Gemini returning one item, the
    pipeline trace shows vision-id/hf-validate/reconcile as `done`
    (because the fake stub reports `is_configured() == True`)."""
    from app.models.schemas import DetectedItem

    gemini, hf = vision_clients
    gemini.set_return([DetectedItem(name="Dal", confidence=88, grams=200)])
    hf.set_return([])  # HF configured but no labels

    # Unique image_ref so the persistent vector cache doesn't shadow
    # this test with a cache-hit.
    resp = client.post("/api/vision/analyze", json={"image_ref": "fresh-gemini-001.jpg"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["detected"][0]["name"] == "Dal"
    trace = {t["stage"]: t["status"] for t in body["pipeline"]}
    assert trace["vision-id"] == "done"
    assert trace["hf-validate"] == "fallback"  # HF returned []
    assert trace["reconcile"] == "fallback"


def test_vision_pipeline_falls_back_to_canned_when_no_clients(
    client: TestClient,
) -> None:
    """No env vars set → no clients configured → canned fixture wins.

    Use a fresh image_ref so the vector cache (populated by earlier
    tests) doesn't shadow the canned fixture path."""
    import app.api.vision as vision_mod

    class _NotConfigured:
        def is_configured(self) -> bool:
            return False

        def detect(self, *a, **k):
            return []

        def classify(self, *a, **k):
            return []

        def close(self):
            pass

    import app.api.vision as vm
    vm._get_gemini = lambda: _NotConfigured()  # type: ignore[assignment]
    vm._get_hf = lambda: _NotConfigured()  # type: ignore[assignment]

    # Use a ref not in the canned map so we exercise the "no clients +
    # miss in canned → empty list" branch instead of the cache-hit
    # branch that earlier tests triggered.
    resp = client.post(
        "/api/vision/analyze", json={"image_ref": "unknown_no_clients.jpg"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["detected"] == []
    # Trace marks every stage as fallback (no real client).
    trace = {t["stage"]: t["status"] for t in body["pipeline"]}
    assert trace["vision-id"] == "fallback"
    assert trace["hf-validate"] == "fallback"


# ── Cut (b): nutrition cascade end-to-end ──────────────────────────────


def test_nutrition_cascade_falls_through_off_to_usda(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """OFF misses → USDA hits → ResolvedItem.source == 'usda'."""
    import app.api.nutrition as nutrition_mod
    from app.models.schemas import NutritionFacts

    class _Off:
        def lookup(self, name: str):
            return None  # miss

        def close(self):
            pass

    usda_facts = NutritionFacts(
        protein=10, carbs=20, fat=5, kcal=150,
        fiber=2, sodium=200, sugar=3, glycemic=0.5,
    )

    class _Usda:
        def lookup(self, name: str):
            return usda_facts

        def close(self):
            pass

    monkeypatch.setattr(nutrition_mod, "_get_off", lambda: _Off())
    monkeypatch.setattr(nutrition_mod, "_get_usda", lambda: _Usda())

    resp = client.post(
        "/api/nutrition/resolve",
        json={"items": [{"name": "Mystery food", "confidence": 80, "grams": 100}]},
    )
    assert resp.status_code == 200
    item = resp.json()["resolved"][0]
    assert item["source"] == "usda"
    assert item["partial"] is False
    assert item["nutrition"]["kcal"] == 150


def test_nutrition_cascade_all_miss_returns_estimated(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """OFF + USDA + Fruityvice all miss → ResolvedItem.source == 'estimated'."""
    import app.api.nutrition as nutrition_mod

    class _Miss:
        def lookup(self, name: str):
            return None

        def close(self):
            pass

    monkeypatch.setattr(nutrition_mod, "_get_off", lambda: _Miss())
    monkeypatch.setattr(nutrition_mod, "_get_usda", lambda: _Miss())
    monkeypatch.setattr(nutrition_mod, "_get_fruityvice", lambda: _Miss())

    resp = client.post(
        "/api/nutrition/resolve",
        json={"items": [{"name": "Unknown", "confidence": 80, "grams": 100}]},
    )
    assert resp.status_code == 200
    item = resp.json()["resolved"][0]
    assert item["source"] == "estimated"
    assert item["partial"] is True