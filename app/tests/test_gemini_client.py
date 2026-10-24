"""Tests for Gemini image request construction and response parsing."""

from __future__ import annotations

import base64
import json

import httpx

from app.services.gemini_client import GeminiClient


def test_detect_sends_image_and_parses_local_food_response() -> None:
    image_data = base64.b64encode(b"test food photo").decode("ascii")
    image_ref = f"data:image/jpeg;base64,{image_data}"
    seen: dict[str, object] = {}

    def respond(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["api_key_header"] = request.headers.get("x-goog-api-key")
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": (
                                        '[{"name":"Khichuri","name_bn":"খিচুড়ি",'
                                        '"confidence":94,"grams":250},'
                                        '{"name":"Ilish macher jhol",'
                                        '"name_bn":"ইলিশের ঝোল",'
                                        '"confidence":88,"grams":160}]'
                                    )
                                }
                            ]
                        }
                    }
                ]
            },
        )

    client = GeminiClient(
        api_key="test-only-key",
        model="gemini-test-model",
        base_url="https://gemini.test/v1beta/models",
    )
    client._client = httpx.Client(transport=httpx.MockTransport(respond))
    try:
        detected = client.detect(image_ref)
    finally:
        client.close()

    assert "key=" not in str(seen["url"])
    assert seen["api_key_header"] == "test-only-key"
    request_body = seen["body"]
    assert isinstance(request_body, dict)
    parts = request_body["contents"][0]["parts"]
    assert "Bangladeshi" in parts[0]["text"]
    assert "khichuri" in parts[0]["text"]
    image_part = parts[1]["inline_data"]
    assert image_part == {"mime_type": "image/jpeg", "data": image_data}
    assert [(item.name, item.confidence) for item in detected] == [
        ("Khichuri", 94),
        ("Ilish macher jhol", 88),
    ]
    assert [item.name_bn for item in detected] == ["খিচুড়ি", "ইলিশের ঝোল"]


def test_unconfigured_client_does_not_make_a_request() -> None:
    client = GeminiClient(api_key="")

    assert client.is_configured() is False
    assert client.detect("data:image/jpeg;base64,dGVzdA==") == []
