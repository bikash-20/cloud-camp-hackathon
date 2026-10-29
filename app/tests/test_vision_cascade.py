"""Tests for the Gemini -> Groq -> HF vision cascade."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import DetectedItem
import app.api.vision as vision_mod


class _MockVisionProvider:
    def __init__(self, configured: bool = True, return_items: list[DetectedItem] | None = None) -> None:
        self._configured = configured
        self._items = return_items or []
        self.call_count = 0

    def is_configured(self) -> bool:
        return self._configured

    def detect(self, image_ref: str) -> list[DetectedItem]:
        self.call_count += 1
        return self._items

    def close(self) -> None:
        pass


class _MockHFClassifier:
    def __init__(self, configured: bool = False, return_labels: list[tuple[str, float]] | None = None) -> None:
        self._configured = configured
        self._labels = return_labels or []
        self.call_count = 0

    def is_configured(self) -> bool:
        return self._configured

    def classify(self, image_ref: str) -> list[tuple[str, float]]:
        self.call_count += 1
        return self._labels

    def close(self) -> None:
        pass


@pytest.fixture
def test_client(tmp_path: Path):
    import os
    os.environ["SQLITE_CACHE_PATH"] = str(tmp_path / "test_cascade_cache.db")
    os.environ["CHROMA_CACHE_PATH"] = str(tmp_path / "test_cascade_chroma")
    vision_mod._reset_for_tests()
    with TestClient(app) as c:
        yield c
    vision_mod._reset_for_tests()


def test_gemini_success_does_not_call_groq(test_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """When Gemini succeeds, Groq is not called (cascade stops)."""
    gemini_item = DetectedItem(name="Steamed rice", confidence=95, grams=200)
    gemini = _MockVisionProvider(configured=True, return_items=[gemini_item])
    groq = _MockVisionProvider(configured=True, return_items=[])
    hf = _MockHFClassifier(configured=False)

    monkeypatch.setattr(vision_mod, "_get_gemini", lambda: gemini)
    monkeypatch.setattr(vision_mod, "_get_groq", lambda: groq)
    monkeypatch.setattr(vision_mod, "_get_hf", lambda: hf)

    resp = test_client.post("/api/vision/analyze", json={"image_ref": "fresh-cascade-test-1.jpg"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["detected"][0]["name"] == "Steamed rice"
    assert gemini.call_count == 1
    assert groq.call_count == 0  # Groq should not be invoked!
    trace = {t["stage"]: t for t in body["pipeline"]}
    assert trace["vision-id"]["status"] == "done"
    assert "Gemini" in trace["vision-id"]["label"]


def test_gemini_failure_cascades_to_groq(test_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """When Gemini returns empty / fails, pipeline cascades to Groq."""
    groq_item = DetectedItem(name="Chicken biryani", name_bn="চিকেন বিরিয়ানি", confidence=91, grams=300)
    gemini = _MockVisionProvider(configured=True, return_items=[])  # Gemini misses
    groq = _MockVisionProvider(configured=True, return_items=[groq_item])
    hf = _MockHFClassifier(configured=False)

    monkeypatch.setattr(vision_mod, "_get_gemini", lambda: gemini)
    monkeypatch.setattr(vision_mod, "_get_groq", lambda: groq)
    monkeypatch.setattr(vision_mod, "_get_hf", lambda: hf)

    resp = test_client.post("/api/vision/analyze", json={"image_ref": "fresh-cascade-test-2.jpg"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["detected"]) == 1
    assert body["detected"][0]["name"] == "Chicken biryani"
    assert body["detected"][0]["name_bn"] == "চিকেন বিরিয়ানি"
    assert gemini.call_count == 1
    assert groq.call_count == 1  # Groq was called in cascade!
    trace = {t["stage"]: t for t in body["pipeline"]}
    assert trace["vision-id"]["status"] == "done"
    assert "Groq" in trace["vision-id"]["label"]


def test_gemini_unconfigured_uses_groq_directly(test_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """When only Groq is configured, Groq handles detection directly."""
    groq_item = DetectedItem(name="Lentil dal", confidence=88, grams=150)
    gemini = _MockVisionProvider(configured=False)
    groq = _MockVisionProvider(configured=True, return_items=[groq_item])
    hf = _MockHFClassifier(configured=False)

    monkeypatch.setattr(vision_mod, "_get_gemini", lambda: gemini)
    monkeypatch.setattr(vision_mod, "_get_groq", lambda: groq)
    monkeypatch.setattr(vision_mod, "_get_hf", lambda: hf)

    resp = test_client.post("/api/vision/analyze", json={"image_ref": "fresh-cascade-test-3.jpg"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["detected"][0]["name"] == "Lentil dal"
    assert gemini.call_count == 0
    assert groq.call_count == 1


def test_neither_gemini_nor_groq_nor_hf_returns_503(test_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """When no provider has a key configured, route returns 503."""
    gemini = _MockVisionProvider(configured=False)
    groq = _MockVisionProvider(configured=False)
    hf = _MockHFClassifier(configured=False)

    monkeypatch.setattr(vision_mod, "_get_gemini", lambda: gemini)
    monkeypatch.setattr(vision_mod, "_get_groq", lambda: groq)
    monkeypatch.setattr(vision_mod, "_get_hf", lambda: hf)

    resp = test_client.post("/api/vision/analyze", json={"image_ref": "fresh-cascade-test-4.jpg"})
    assert resp.status_code == 503
    assert "GROQ_API_KEY" in resp.json()["detail"]


def test_gemini_and_groq_failure_cascades_to_openrouter(test_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """When both Gemini and Groq fail, pipeline cascades to OpenRouter Vision."""
    or_item = DetectedItem(name="Begun bhaji", name_bn="বেগুন ভাজি", confidence=93, grams=120)
    gemini = _MockVisionProvider(configured=True, return_items=[])
    groq = _MockVisionProvider(configured=True, return_items=[])
    openrouter = _MockVisionProvider(configured=True, return_items=[or_item])
    hf = _MockHFClassifier(configured=False)

    monkeypatch.setattr(vision_mod, "_get_gemini", lambda: gemini)
    monkeypatch.setattr(vision_mod, "_get_groq", lambda: groq)
    monkeypatch.setattr(vision_mod, "_get_openrouter", lambda: openrouter)
    monkeypatch.setattr(vision_mod, "_get_hf", lambda: hf)

    resp = test_client.post("/api/vision/analyze", json={"image_ref": "fresh-cascade-test-5.jpg"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["detected"]) == 1
    assert body["detected"][0]["name"] == "Begun bhaji"
    assert body["detected"][0]["name_bn"] == "বেগুন ভাজি"
    assert gemini.call_count == 1
    assert groq.call_count == 1
    assert openrouter.call_count == 1
    trace = {t["stage"]: t for t in body["pipeline"]}
    assert trace["vision-id"]["status"] == "done"
    assert "OpenRouter" in trace["vision-id"]["label"]

