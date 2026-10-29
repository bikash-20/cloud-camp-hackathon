"""Groq vision client for fast multimodal inference and cascade fallback.

Groq exposes an OpenAI-compatible endpoint:
  POST {base_url}/chat/completions
with:
  Authorization: Bearer {api_key}
and messages containing text instructions and image_url payload with base64 data.

Models supported include `llama-3.2-11b-vision-preview`,
`llama-3.2-90b-vision-preview`, and `qwen/qwen3.8-27b`.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from pathlib import Path
from typing import Any

import httpx

from app.models.schemas import BBox, DetectedItem
from app.services._http_logging import log_http_failure
from app.services.gemini_client import _DETECTION_PROMPT, _read_image


log = logging.getLogger(__name__)

DEFAULT_MODEL = "llama-3.2-11b-vision-preview"
DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
USER_AGENT = "NutriVisionDemo/0.1 (hackathon demo)"

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


class GroqClient:
    """HTTP client for Groq's multimodal / vision models."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self.api_key = api_key or os.environ.get("GROQ_API_KEY") or ""
        self.model = (
            model
            or os.environ.get("GROQ_MODEL")
            or os.environ.get("GROQ_VISION_MODEL")
            or DEFAULT_MODEL
        )
        self.base_url = (
            base_url or os.environ.get("GROQ_BASE_URL") or DEFAULT_BASE_URL
        ).rstrip("/")
        self._client: httpx.Client | None = None

    def _http(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(
                headers={
                    "User-Agent": USER_AGENT,
                    "Authorization": f"Bearer {self.api_key}",
                },
                timeout=httpx.Timeout(15.0, connect=5.0),
            )
        return self._client

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    def is_configured(self) -> bool:
        """True iff a key is set."""
        return bool(self.api_key)

    def detect(self, image_ref: str) -> list[DetectedItem]:
        """Run food detection against Groq vision API.

        Accepts either a base64 data URL (`data:image/jpeg;base64,...`) or a
        local file path. Returns `[]` on any failure so callers can gracefully
        continue the pipeline cascade.
        """
        if not self.is_configured():
            return []

        try:
            image_b64, mime = _read_image(image_ref)
        except (OSError, ValueError) as exc:
            log.warning("Groq: cannot read image (%s)", type(exc).__name__)
            return []

        data_url = f"data:{mime};base64,{image_b64}"
        body = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _DETECTION_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                    ],
                }
            ],
            "temperature": 0.1,
            "max_tokens": 1024,
        }

        url = f"{self.base_url}/chat/completions"
        headers = {
            "User-Agent": USER_AGENT,
            "Authorization": f"Bearer {self.api_key}",
        }
        try:
            resp = self._http().post(url, headers=headers, json=body)
            resp.raise_for_status()
            payload = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            log_http_failure("Groq", exc, image_ref=image_ref)
            return []

        return _parse_groq_response(payload)


def _parse_groq_response(payload: dict[str, Any]) -> list[DetectedItem]:
    """Tolerantly extract the DetectedItem array from a Groq chat completion."""
    choices = payload.get("choices") or []
    if not choices:
        return []
    message = choices[0].get("message") or {}
    text = message.get("content") or ""
    if not isinstance(text, str) or not text.strip():
        return []

    # Strip code fences if present.
    match = _JSON_FENCE_RE.search(text)
    if match:
        text = match.group(1)

    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return []

    try:
        items = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return []

    out: list[DetectedItem] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        name = str(it.get("name", "")).strip()
        if not name:
            continue
        name_bn = str(it.get("name_bn", "")).strip() or None
        try:
            confidence = float(it.get("confidence", 0))
        except (TypeError, ValueError):
            confidence = 0.0
        try:
            grams = float(it.get("grams", 100))
        except (TypeError, ValueError):
            grams = 100.0

        bbox: BBox | None = None
        raw_bbox = it.get("bbox")
        if isinstance(raw_bbox, (list, tuple)) and len(raw_bbox) == 4:
            try:
                bbox = (
                    float(raw_bbox[0]),
                    float(raw_bbox[1]),
                    float(raw_bbox[2]),
                    float(raw_bbox[3]),
                )
            except (TypeError, ValueError):
                bbox = None

        out.append(
            DetectedItem(
                name=name,
                name_bn=name_bn,
                confidence=confidence,
                grams=grams,
                bbox=bbox,
            )
        )
    return out
