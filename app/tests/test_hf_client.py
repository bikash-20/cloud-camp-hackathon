"""Tests for Hugging Face image classification requests."""

from __future__ import annotations

import base64
import json

import httpx
import pytest

from app.services.hf_client import HFClient


def test_classify_sends_configured_bearer_token_and_image(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    image_data = base64.b64encode(b"test food photo").decode("ascii")
    image_ref = f"data:image/jpeg;base64,{image_data}"
    seen: dict[str, object] = {}

    def respond(request: httpx.Request) -> httpx.Response:
        seen["authorization"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json=[{"label": "rice", "score": 0.91}],
        )

    real_httpx_client = httpx.Client

    def make_http_client(**kwargs: object) -> httpx.Client:
        kwargs["transport"] = httpx.MockTransport(respond)
        return real_httpx_client(**kwargs)

    monkeypatch.setattr("app.services.hf_client.httpx.Client", make_http_client)
    client = HFClient(
        api_token="test-only-token",
        model="test-food-model",
        base_url="https://hf.test",
    )
    try:
        labels = client.classify(image_ref)
    finally:
        client.close()

    assert seen["authorization"] == "Bearer test-only-token"
    assert seen["body"] == {
        "inputs": {"image": f"data:image/jpeg;base64,{image_data}"}
    }
    assert labels == [("rice", 0.91)]
