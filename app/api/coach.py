"""FastAPI router for Multi-Agent AI Coach — `POST /api/coach/chat`.

Routes requests to:
  - 🔬 Culinary & Nutrition Scientist (পুষ্টি বিজ্ঞানী)
  - 🧠 Behavioral & Habit Coach (আচরণ ও অভ্যাস কোচ)
with RAG enrichment, provider fallback, and authentic citations.
"""

from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException

from app.models.schemas import CoachChatRequest, CoachChatResponse
from app.services.coach_service import get_coach_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coach", tags=["coach"])


@router.post("/chat", response_model=CoachChatResponse)
def coach_chat(req: CoachChatRequest) -> CoachChatResponse:
    """Send conversation messages to the requested AI Coach persona."""
    if not req.messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty.")
    try:
        service = get_coach_service()
        return service.chat(req)
    except Exception as exc:
        log.error("AI Coach chat encountered error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI Coach error: {exc}") from exc
