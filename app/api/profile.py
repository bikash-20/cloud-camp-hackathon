"""Profile GET/PUT — mirrors `src/lib/api.ts#getProfile` / `updateProfile`.

The frontend's mock client persists to localStorage; the backend
skeleton persists to `state.json` via `app.services.state.State`.
Auth (login/logout/getSession) is **not** implemented here — that's
still mock-grade in the frontend for cut (a).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.models.schemas import UserProfile
from app.services.state import State, get_state


router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("", response_model=UserProfile)
def get_profile(state: State = Depends(get_state)) -> UserProfile:
    """Return the current profile, default-seeded on first call."""
    return state.get_profile()


@router.put("", response_model=UserProfile)
def update_profile(
    profile: UserProfile,
    state: State = Depends(get_state),
) -> UserProfile:
    """Replace the current profile with the supplied one.

    The frontend passes the full `UserProfile` shape — there's no
    PATCH endpoint in the mock client, so PUT semantics are a faithful
    mirror. Future cuts may add `PATCH` for partial updates.
    """
    return state.set_profile(profile)
