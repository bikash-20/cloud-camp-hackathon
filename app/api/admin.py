"""Admin Telemetry & User Management API.

Provides system-wide aggregated metrics, active user activity, and detection
quality analytics for the NutriVision AI Admin Dashboard.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import require_admin_user
from app.models.schemas import AdminMetrics, AuthSession
from app.services.state import State, get_state

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/metrics", response_model=AdminMetrics)
def get_admin_metrics(
    current_user: AuthSession = Depends(require_admin_user),
    state: State = Depends(get_state),
) -> AdminMetrics:
    """Return aggregated platform metrics. Requires admin privileges."""
    return state.get_admin_metrics()
