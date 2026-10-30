"""Unit tests for Admin Telemetry & Metrics API."""

from __future__ import annotations

import time
import pytest
from fastapi.testclient import TestClient

from app.api.auth import create_jwt
from app.main import create_app
from app.services.state import init_state


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("STATE_PATH", str(tmp_path / "test_admin_state.json"))
    monkeypatch.setenv("ADMIN_EMAILS", "superadmin@domain.com")
    monkeypatch.setenv("JWT_SECRET", "admin-test-secret-12345")
    init_state(tmp_path / "test_admin_state.json")
    app = create_app()
    return TestClient(app)


def test_admin_metrics_endpoint_unauthenticated_or_demo(client):
    res = client.get("/api/admin/metrics")
    assert res.status_code == 200
    data = res.json()
    assert "totalUsers" in data or "total_users" in data
    assert "mealsToday" in data or "meals_today" in data


def test_admin_metrics_forbidden_for_regular_user(client):
    user_jwt = create_jwt(
        {"sub": "regular-1", "email": "regular@domain.com", "role": "user", "exp": int(time.time()) + 3600},
        secret=b"admin-test-secret-12345",
    )
    res = client.get("/api/admin/metrics", headers={"Authorization": f"Bearer {user_jwt}"})
    assert res.status_code == 403


def test_admin_metrics_allowed_for_admin_user(client):
    admin_jwt = create_jwt(
        {"sub": "adm-1", "email": "superadmin@domain.com", "role": "admin", "exp": int(time.time()) + 3600},
        secret=b"admin-test-secret-12345",
    )
    res = client.get("/api/admin/metrics", headers={"Authorization": f"Bearer {admin_jwt}"})
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data["users"], list)
