"""Google Gemini vision client.

Gemini 2.0 Flash is the default model — fast, cheap, decent on food
photos. The API is `POST /v1beta/models/{model}:generateContent?key=...`
with a JSON body containing an `inline_data` block (base64 image) and
a prompt asking for a JSON list of detected items.

`is_configured()` is the gate the route handler uses to decide between
real Gemini and the canned fallback. If `GEMINI_API_KEY` is unset, all
calls short-circuit to `[]` so the route can degrade gracefully.

The prompt asks Gemini to return a JSON array of
`{name, confidence (0–100), grams, bbox?}`. The handler parses that
with a tolerant regex (Gemini sometimes wraps the JSON in ``` fences).
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


log = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-2.0-flash"
DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
USER_AGENT = "NutriVisionDemo/0.1 (hackathon demo)"

# The prompt intentionally asks for strict JSON so we can `json.loads`
# without a heavy parser. Gemini 2.0 Flash respects this most of the
# time but occasionally wraps in ```json … ``` fences — `re.DOTALL`
# below strips them.
_DETECTION_PROMPT = """\
You are a vision system for a nutrition app. Look at the photo and
return ONLY a JSON array (no prose, no code fences) of food items.

Each element must match this shape exactly:
  {"name": "<food>", "confidence": <0–100 integer>, "grams": <estimated portion in grams>, "bbox": [x, y, w, h]}

`bbox` is the item's normalized bounding box in [0, 1] image space,
optional. If you cannot detect any food, return [].
"""


class GeminiClient:
    """Thin wrapper around the Gemini `generateContent` REST endpoint."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY") or ""
        self.model = model or os.environ.get("GEMINI_MODEL") or DEFAULT_MODEL
        self.base_url = (
            base_url or os.environ.get("GEMINI_BASE_URL") or DEFAULT_BASE_URL
        ).rstrip("/")
        self._client: httpx.Client | None = None

    def _http(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(
                headers={"User-Agent": USER_AGENT},
                timeout=httpx.Timeout(15.0, connect=5.0),
            )
        return self._client

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    def is_configured(self) -> bool:
        """True iff a key is set — the route handler uses this to
        decide between real Gemini and the canned fallback."""
        return bool(self.api_key)

    def detect(self, image_ref: str) -> list[DetectedItem]:
        """Run the Gemini detection prompt against the image.

        `image_ref` is a base64 data URL (`data:image/jpeg;base64,…`)
        or a local file path. Returns `[]` on any error so callers can
        fall back to HF / canned fixtures without a try/except.
        """
        if not self.is_configured():
            return []
        try:
            image_b64, mime = _read_image(image_ref)
        except (OSError, ValueError) as exc:
            log.warning("Gemini: cannot read image %r: %s", image_ref, exc)
            return []

        body = {
            "contents": [
                {
                    "parts": [
                        {"text": _DETECTION_PROMPT},
                        {
                            "inline_data": {
                                "mime_type": mime,
                                "data": image_b64,
                            }
                        },
                    ]
                }
            ]
        }

        url = f"{self.base_url}/{self.model}:generateContent"
        try:
            resp = self._http().post(
                url, params={"key": self.api_key}, json=body
            )
            resp.raise_for_status()
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("Gemini request failed: %s", exc)
            return []

        return _parse_gemini_response(resp.json())


def _read_image(image_ref: str) -> tuple[str, str]:
    """Return (base64_payload, mime_type). Accepts either a data URL
    (`data:image/jpeg;base64,…`) or a local file path.

    File paths are read as JPEG by default — the frontend's
    `captureFrame()` writes canvas.toDataURL('image/jpeg', 0.92), so
    this matches reality.
    """
    if image_ref.startswith("data:"):
        # data:[<mime>];base64,<payload>
        head, _, payload = image_ref.partition(",")
        mime = head.split(":", 1)[1].split(";", 1)[0] or "image/jpeg"
        return payload, mime
    path = Path(image_ref)
    if not path.is_file():
        raise OSError(f"not a file: {image_ref}")
    suffix = path.suffix.lower()
    mime = {
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(suffix, "image/jpeg")
    return base64.b64encode(path.read_bytes()).decode("ascii"), mime


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def _parse_gemini_response(payload: dict[str, Any]) -> list[DetectedItem]:
    """Tolerantly extract the JSON array from a Gemini response.

    Gemini occasionally:
      - wraps the JSON in ``` fences,
      - adds a short preamble before the JSON,
      - returns `{ "text": "..." }` rather than the documented shape.
    """
    text = _extract_text(payload)
    if not text:
        return []
    # Strip code fences if present.
    match = _JSON_FENCE_RE.search(text)
    if match:
        text = match.group(1)
    # Find the first '[' and the matching ']' (tolerates trailing prose).
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
                name=name, confidence=confidence, grams=grams, bbox=bbox
            )
        )
    return out


def _extract_text(payload: dict[str, Any]) -> str:
    """Pull the text content out of a Gemini response, tolerating the
    documented `candidates[0].content.parts[0].text` shape as well as
    a flat `text` field that some preview models return."""
    candidates = payload.get("candidates") or []
    if candidates:
        content = (candidates[0] or {}).get("content") or {}
        parts = content.get("parts") or []
        if parts and isinstance(parts[0], dict):
            text = parts[0].get("text")
            if isinstance(text, str):
                return text
    text = payload.get("text")
    return text if isinstance(text, str) else ""
