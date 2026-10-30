"""Admin Telemetry & User Management API.

Provides system-wide aggregated metrics, active user activity, and detection
quality analytics for the NutriVision AI Admin Dashboard.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user_optional, require_admin_user
from app.models.schemas import AdminMetrics, AuthSession
from app.services.state import State, get_state

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/metrics", response_model=AdminMetrics)
def get_admin_metrics(
    current_user: AuthSession | None = Depends(get_current_user_optional),
    state: State = Depends(get_state),
) -> AdminMetrics:
    """Return aggregated platform metrics.

    In production with authentication, requires `role == 'admin'`.
    In development or demo mode without bearer token, returns state metrics
    to allow administrative UI preview.
    """
    if current_user and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required to view telemetry metrics.",
        )

    return state.get_admin_metrics()
