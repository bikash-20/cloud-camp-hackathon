"""Unit tests for Multi-Agent AI Coach endpoint `/api/coach/chat`."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.models.schemas import CoachAgentType, CoachChatRequest, CoachMessage, UserProfile


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    return TestClient(app)


def test_coach_chat_validation_empty_messages(client: TestClient) -> None:
    res = client.post("/api/coach/chat", json={"messages": [], "agent_type": "scientist"})
    assert res.status_code == 400
    assert "Messages list cannot be empty" in res.json()["detail"]


def test_coach_chat_scientist_persona(client: TestClient) -> None:
    payload = {
        "messages": [
            {"role": "user", "content": "এই খাবারের গ্লাইসেমিক লোড কীভাবে কমাব?"}
        ],
        "agent_type": "scientist",
        "user_profile": {
            "name": "Rafi",
            "age": 28,
            "sex": "male",
            "height_cm": 172,
            "weight_kg": 70,
            "height_unit": "cm",
            "weight_unit": "kg",
            "activity_level": "moderate",
            "goal": "maintain",
            "target_rate_kg_per_week": 0.0,
            "diet_type": "halal",
            "medical_conditions": ["prediabetes"],
            "meals_per_day": 3,
            "budget": 500.0,
            "serving": 1,
            "goals": {"diabetic": True, "protein": False, "budget": True, "mediter": False},
            "preferences": [],
            "allergens": ["Peanuts"],
            "daily_kcal_target": 2000.0,
        },
    }
    res = client.post("/api/coach/chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["agent_type"] == "scientist"
    assert len(data["reply"]) > 50
    assert len(data["suggested_prompts"]) > 0
    assert len(data["citations"]) > 0


def test_coach_chat_behavioral_persona(client: TestClient) -> None:
    payload = {
        "messages": [
            {"role": "user", "content": "দাওয়াতে অতিরিক্ত খাওয়ার পর কী করব?"}
        ],
        "agent_type": "behavioral",
    }
    res = client.post("/api/coach/chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["agent_type"] == "behavioral"
    assert len(data["reply"]) > 50
    assert any("দাওয়াত" in p or "মিষ্টি" in p or "অভ্যাস" in p for p in data["suggested_prompts"])


def test_coach_chat_hello_greeting_scientist(client: TestClient) -> None:
    """The 'Hello' Fix: greetings must yield concise warm responses, not lectures."""
    payload = {
        "message": "হ্যালো",
        "history": [],
        "agent_type": "scientist",
    }
    res = client.post("/api/coach/chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["agent_type"] == "scientist"
    # Should be a short, natural greeting (under 120 chars)
    assert len(data["reply"]) < 120
    assert "হ্যালো" in data["reply"]
    assert "পুষ্টি" in data["reply"] or "ক্যালরি" in data["reply"]


def test_coach_chat_hello_greeting_coach(client: TestClient) -> None:
    """The 'Hello' Fix: coach greeting in English returns empathetic short welcome."""
    payload = {
        "message": "hello",
        "history": [],
        "agent_type": "coach",
    }
    res = client.post("/api/coach/chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["agent_type"] == "coach"
    assert len(data["reply"]) < 120
    assert "Hello" in data["reply"] or "হ্যালো" in data["reply"]


def test_coach_openrouter_fallback(monkeypatch: pytest.MonkeyPatch, client: TestClient) -> None:
    """Ensure OpenRouter is called if Gemini fails or is unavailable."""
    from app.services.coach_service import get_coach_service
    service = get_coach_service()

    called_openrouter = False

    def mock_call_gemini(system_prompt: str, messages: list) -> str | None:
        return None  # Simulate Gemini 429/failure

    def mock_call_openrouter(system_prompt: str, messages: list) -> str | None:
        nonlocal called_openrouter
        called_openrouter = True
        return "Responded via OpenRouter fallback successfully."

    monkeypatch.setattr(service, "_call_gemini", mock_call_gemini)
    monkeypatch.setattr(service, "_call_openrouter", mock_call_openrouter)
    monkeypatch.setattr(service, "openrouter_key", "sk-or-test-key")

    res = client.post("/api/coach/chat", json={"message": "What is GI?", "agent_type": "scientist"})
    assert res.status_code == 200
    data = res.json()
    assert called_openrouter is True
    assert "OpenRouter" in data["reply"]


