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
