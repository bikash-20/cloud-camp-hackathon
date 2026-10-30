"""Unit tests for Google authentication, JWT session verification, and multi-user isolation."""

from __future__ import annotations

import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.api.auth import create_jwt, verify_jwt
from app.main import create_app
from app.services.state import init_state


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("STATE_PATH", str(tmp_path / "test_state.json"))
    monkeypatch.setenv("ADMIN_EMAILS", "admin@nutrivision.ai,boss@domain.com")
    monkeypatch.setenv("JWT_SECRET", "test-secret-key-1234567890")
    init_state(tmp_path / "test_state.json")
    app = create_app()
    return TestClient(app)


def test_jwt_create_and_verify_roundtrip():
    payload = {"sub": "123", "email": "test@example.com", "role": "user", "exp": int(time.time()) + 3600}
    secret = b"my-custom-test-secret"
    token = create_jwt(payload, secret)
    assert isinstance(token, str)
    decoded = verify_jwt(token, secret)
    assert decoded is not None
    assert decoded["email"] == "test@example.com"
    assert decoded["sub"] == "123"


def test_jwt_expired_returns_none():
    payload = {"sub": "123", "email": "test@example.com", "exp": int(time.time()) - 100}
    secret = b"my-custom-test-secret"
    token = create_jwt(payload, secret)
    assert verify_jwt(token, secret) is None


def test_jwt_tampered_returns_none():
    payload = {"sub": "123", "email": "test@example.com", "exp": int(time.time()) + 3600}
    secret = b"my-custom-test-secret"
    token = create_jwt(payload, secret)
    tampered = token[:-4] + "abcd"
    assert verify_jwt(tampered, secret) is None


def test_demo_login_user_and_admin(client):
    # User demo login
    res_user = client.post("/api/auth/demo?role=user")
    assert res_user.status_code == 200
    user_data = res_user.json()
    assert user_data["session"]["role"] == "user"
    assert "token" in user_data

    # Admin demo login
    res_admin = client.post("/api/auth/demo?role=admin")
    assert res_admin.status_code == 200
    admin_data = res_admin.json()
    assert admin_data["session"]["role"] == "admin"
    assert admin_data["session"]["email"] == "admin@nutrivision.ai"


def test_google_sign_in_regular_user(client):
    mock_google_info = {
        "iss": "https://accounts.google.com",
        "sub": "google-user-999",
        "email": "fresh.user@gmail.com",
        "email_verified": "true",
        "name": "Fresh User",
        "picture": "https://lh3.googleusercontent.com/photo.jpg",
        "exp": str(int(time.time()) + 3600),
    }

    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_google_info
        mock_get.return_value = mock_resp

        res = client.post("/api/auth/google", json={"idToken": "fake-google-id-token"})
        assert res.status_code == 200
        data = res.json()
        assert data["session"]["email"] == "fresh.user@gmail.com"
        assert data["session"]["name"] == "Fresh User"
        assert data["session"]["role"] == "user"
        assert data["session"]["avatarUrl"] == "https://lh3.googleusercontent.com/photo.jpg"
        assert data["token"] is not None


def test_google_sign_in_admin_user_via_whitelist(client):
    mock_google_info = {
        "iss": "https://accounts.google.com",
        "sub": "google-admin-001",
        "email": "boss@domain.com",
        "email_verified": "true",
        "name": "Big Boss",
        "picture": "https://lh3.googleusercontent.com/admin.jpg",
        "exp": str(int(time.time()) + 3600),
    }

    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_google_info
        mock_get.return_value = mock_resp

        res = client.post("/api/auth/google", json={"idToken": "fake-admin-token"})
        assert res.status_code == 200
        data = res.json()
        assert data["session"]["email"] == "boss@domain.com"
        assert data["session"]["role"] == "admin"


def test_multi_user_data_isolation(client):
    # User 1 token
    tok1 = create_jwt({"sub": "u1", "email": "user1@gmail.com", "role": "user", "exp": int(time.time()) + 3600})
    headers1 = {"Authorization": f"Bearer {tok1}"}

    # User 2 token
    tok2 = create_jwt({"sub": "u2", "email": "user2@gmail.com", "role": "user", "exp": int(time.time()) + 3600})
    headers2 = {"Authorization": f"Bearer {tok2}"}

    # User 1 posts a meal
    m1 = {
        "label": "User 1 Salad",
        "items": [{"name": "Salad", "confidence": 95.0, "grams": 150.0}],
        "totals": {"kcal": 150, "protein": 5, "carbs": 10, "fat": 2, "fiber": 4, "sodium": 80, "sugar": 3},
        "active_goals": {"diabetic": False, "protein": False, "budget": False, "mediter": False},
    }
    r1 = client.post("/api/meals", json=m1, headers=headers1)
    assert r1.status_code == 201

    # User 2 gets meals — should be empty (isolated from User 1!)
    r2_meals = client.get("/api/meals", headers=headers2)
    assert r2_meals.status_code == 200
    assert len(r2_meals.json()) == 0

    # User 1 gets meals — should have 1 meal
    r1_meals = client.get("/api/meals", headers=headers1)
    assert r1_meals.status_code == 200
    assert len(r1_meals.json()) == 1
    assert r1_meals.json()[0]["label"] == "User 1 Salad"
