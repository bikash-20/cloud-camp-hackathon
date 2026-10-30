"""OpenRouter Multimodal Vision Client.

Cascades across vision-capable models on OpenRouter:
  1. google/gemini-2.0-flash-001 (or user configured OPENROUTER_VISION_MODEL)
  2. meta-llama/llama-3.2-11b-vision-instruct
  3. openrouter/auto
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from app.models.schemas import DetectedItem, VisionDetectionResult
from app.services.gemini_client import (
    _DETECTION_PROMPT,
    _parse_vision_result,
    _read_image,
)

log = logging.getLogger(__name__)

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_VISION_MODELS = [
    # Top free multimodal vision models on OpenRouter (work with $0 balance):
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3.5-super-vl:free",
    "openrouter/free",
    "google/gemma-4-26b-a4b-it:free",
    # Standard vision models (if paid balance exists):
    "google/gemini-2.0-flash-001",
    "meta-llama/llama-3.2-11b-vision-instruct",
    "openrouter/auto",
]
USER_AGENT = "NutriVisionDemo/0.1 (hackathon demo)"


class OpenRouterVisionClient:
    """HTTP client for OpenRouter multimodal vision models."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
    ) -> None:
        self.api_key = (
            api_key if api_key is not None else os.environ.get("OPENROUTER_API_KEY") or ""
        ).strip()
        self.model = (model or os.environ.get("OPENROUTER_VISION_MODEL") or "").strip()
        self._client: httpx.Client | None = None

    def _http(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(
                headers={"User-Agent": USER_AGENT},
                timeout=httpx.Timeout(6.5, connect=3.0),
            )
        return self._client

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    def is_configured(self) -> bool:
        """True iff OPENROUTER_API_KEY is set."""
        return bool(self.api_key)

    def detect_vision(self, image_ref: str) -> VisionDetectionResult | None:
        """Run food vision detection using OpenRouter with multi-model cascade."""
        if not self.is_configured():
            return None

        try:
            image_b64, mime = _read_image(image_ref)
        except (OSError, ValueError) as exc:
            log.warning("OpenRouter vision: cannot read image (%s)", type(exc).__name__)
            return None

        data_url = f"data:{mime};base64,{image_b64}"
        candidate_models: list[str] = []
        if self.model:
            candidate_models.append(self.model)
        for m in DEFAULT_VISION_MODELS:
            if m not in candidate_models:
                candidate_models.append(m)
        # Cap candidate attempts to the top 3 high-probability models to eliminate timeout stalls
        candidate_models = candidate_models[:3]

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://nutrivision.ai",
            "X-Title": "NutriVision AI",
            "User-Agent": USER_AGENT,
        }

        for model_name in candidate_models:
            body: dict[str, Any] = {
                "model": model_name,
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
                "max_tokens": 1200,
            }

            try:
                resp = self._http().post(OPENROUTER_API_URL, headers=headers, json=body)
                if resp.status_code == 200:
                    payload = resp.json()
                    choices = payload.get("choices") or []
                    if choices:
                        msg = choices[0].get("message") or {}
                        text = msg.get("content") or msg.get("reasoning") or ""
                        if isinstance(text, str) and text.strip():
                            res = _parse_vision_result(text)
                            if res is not None:
                                log.info("OpenRouter vision model %s succeeded.", model_name)
                                return res
                log.warning(
                    "OpenRouter vision model %s returned HTTP %s; cascading...",
                    model_name,
                    resp.status_code,
                )
            except Exception as exc:
                log.warning("OpenRouter vision model %s exception: %s; cascading...", model_name, exc)

        return None

    def detect(self, image_ref: str) -> list[DetectedItem]:
        """Convenience method returning list of DetectedItem."""
        res = self.detect_vision(image_ref)
        return res.detected if res is not None else []

