"""RAG (Retrieval-Augmented Nutrition) Router.

Exposes `/api/rag/query` for semantic retrieval against domain ChromaDB collections:
  - `bd_recipes_and_hidden_ingredients`
  - `clinical_nutrition_guidelines`
  - `bd_market_and_seasonal_produce`
  - `packaged_food_facts_bd`
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.services.rag_service import (
    RAGQueryRequest,
    RAGQueryResponse,
    get_rag_service,
)

router = APIRouter(prefix="/api/rag", tags=["rag"])


@router.post("/query", response_model=RAGQueryResponse)
def query_rag(request: RAGQueryRequest) -> RAGQueryResponse:
    """Execute vector RAG query against one of the 4 ChromaDB domain collections."""
    service = get_rag_service()
    chunks = service.query(
        collection_name=request.collection_name,
        query_text=request.query,
        filters=request.filters,
        top_k=request.top_k,
    )
    return RAGQueryResponse(
        query=request.query,
        collection=request.collection_name,
        results=chunks,
    )
