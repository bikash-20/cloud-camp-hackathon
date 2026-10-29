"""Tests for Phase 2: ChromaDB Multi-Collection RAG System."""

from __future__ import annotations

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.rag_service import RAGService, get_rag_service


@pytest.fixture
def rag_client(tmp_path: Path):
    import os
    os.environ["CHROMA_CACHE_PATH"] = str(tmp_path / "test_rag_chroma")
    # Reset singleton
    import app.services.rag_service as rag_mod
    rag_mod._rag_service = RAGService(path=tmp_path / "test_rag_chroma")
    with TestClient(app) as c:
        yield c


def test_rag_query_clinical_guidelines_returns_birdem_citation(rag_client: TestClient):
    resp = rag_client.post(
        "/api/rag/query",
        json={
            "query": "What is the recommended rice portion for a diabetic patient?",
            "collection_name": "clinical_nutrition_guidelines",
            "top_k": 2,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["collection"] == "clinical_nutrition_guidelines"
    assert len(data["results"]) > 0
    # First result should discuss rice portion and cite BIRDEM
    first = data["results"][0]
    assert "BIRDEM" in first["citation"] or "BIRDEM" in first["document"]


def test_rag_query_recipes_returns_authentic_shorshe_ilish(rag_client: TestClient):
    resp = rag_client.post(
        "/api/rag/query",
        json={
            "query": "Hilsa fish cooked with mustard oil and green chilies",
            "collection_name": "bd_recipes_and_hidden_ingredients",
            "top_k": 2,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["results"]) > 0
    match = any("Ilish" in r["document"] or "সর্ষে ইলিশ" in r["document"] for r in data["results"])
    assert match is True
    assert "INFS" in data["results"][0]["citation"] or "Bangladesh" in data["results"][0]["citation"]


def test_rag_query_seasonal_produce_returns_winter_market_prices(rag_client: TestClient):
    resp = rag_client.post(
        "/api/rag/query",
        json={
            "query": "Winter seasonal vegetables like cauliflower and spinach prices",
            "collection_name": "bd_market_and_seasonal_produce",
            "top_k": 2,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["results"]) > 0
    assert any("cauliflower" in r["document"].lower() or "phulkopi" in r["document"].lower() for r in data["results"])

