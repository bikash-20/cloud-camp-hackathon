"""Google Gemini vision client.

Gemini 2.0 Flash is the default model — fast, cheap, decent on food
photos. The API is `POST /v1beta/models/{model}:generateContent` with
the API key in the `x-goog-api-key` header
with a JSON body containing an `inline_data` block (base64 image) and
a prompt asking for a JSON list of detected items.

`is_configured()` is the gate the route handler uses to decide between
real Gemini and the canned fallback. If `GEMINI_API_KEY` is unset, all
calls short-circuit to `[]` so the route can degrade gracefully.

The prompt asks Gemini to return a JSON array of
`{name, name_bn, confidence (0–100), grams, bbox?}`. The handler parses that
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
from app.services._http_logging import log_http_failure


log = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-2.0-flash"
DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
USER_AGENT = "NutriVisionDemo/0.1 (hackathon demo)"

# The prompt intentionally asks for strict JSON so we can `json.loads`
# without a heavy parser. Gemini 2.0 Flash respects this most of the
# time but occasionally wraps in ```json … ``` fences — `re.DOTALL`
# below strips them.
_DETECTION_PROMPT = """\
You are an expert food vision and nutrition analysis AI system.
Look at the photo and detect all food items, meat, cooked dishes, raw ingredients, beverages, or meals present.

Return ONLY a JSON array of detected items.
Each item must match this shape:
  {"name": "<canonical English food name>", "name_bn": "<Bengali food name>", "confidence": <0–100 integer>, "grams": <estimated portion in grams>, "bbox": [x, y, w, h]}

Guidelines:
1. Detect any food shown in the image, including any meat (beef, chicken, steak, mutton, lamb, pork, kebab, meat curry, roasted/grilled meat, cuts), fish, rice, lentils/dal, bread, vegetables, salads, or snacks.
2. Even if there is only a single piece of food or meat, ALWAYS detect it and return it in the JSON array: [{"name": "Grilled Beef Steak", ...}].
3. For South Asian and Bangladeshi meals, use a specific local dish name in both `name` and `name_bn` when supported (for example: rice / ভাত, lentil dal / ডাল, khichuri / খিচুড়ি, biryani / বিরিয়ানি, fish curry / মাছের তরকারি, beef curry / গরুর মাংস, bhorta / ভর্তা, bhaji / ভাজি, roti / রুটি, or paratha / পরোটা).
4. Keep `name` in concise English for nutrition database lookups.
5. ONLY return [] if the image contains no food, ingredients, or drinks whatsoever (e.g. furniture, electronic device, car).
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
        """True iff a key is set — the route uses this to select a provider."""
        return bool(self.api_key)

    def detect(self, image_ref: str) -> list[DetectedItem]:
        """Run the Gemini detection prompt against the image.

        `image_ref` is a base64 data URL (`data:image/jpeg;base64,…`)
        or a local file path. Returns `[]` on any error so callers can
        fall back to Hugging Face or return no detections without
        raising an exception.
        """
        if not self.is_configured():
            return []
        try:
            image_b64, mime = _read_image(image_ref)
        except (OSError, ValueError) as exc:
            log.warning("Gemini: cannot read image (%s)", type(exc).__name__)
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
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ],
        }

        url = f"{self.base_url}/{self.model}:generateContent"
        try:
            resp = self._http().post(
                url,
                headers={"x-goog-api-key": self.api_key},
                json=body,
            )
            resp.raise_for_status()
            payload = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            log_http_failure("Gemini", exc, image_ref=image_ref)
            return []

        return _parse_gemini_response(payload)


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

    # Security check: Block path traversal and absolute system paths
    path = Path(image_ref)
    if path.is_absolute() or ".." in image_ref or not path.is_file():
        raise ValueError(f"Invalid image_ref format or inaccessible path: {image_ref}")
    suffix = path.suffix.lower()
    mime = {
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(suffix, "image/jpeg")
    return base64.b64encode(path.read_bytes()).decode("ascii"), mime


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def _parse_gemini_response(payload: dict[str, Any]) -> list[DetectedItem]:
    """Tolerantly extract DetectedItems from a Gemini response."""
    text = _extract_text(payload)
    if not text:
        return []
    return _parse_food_json(text)


def _parse_food_json(text: str) -> list[DetectedItem]:
    """Robust parser that accepts arrays, single objects, and dict wrappers."""
    text = text.strip()
    match = _JSON_FENCE_RE.search(text)
    if match:
        text = match.group(1).strip()

    parsed = None
    try:
        parsed = json.loads(text)
    except Exception:
        pass

    if parsed is None:
        start_arr = text.find("[")
        end_arr = text.rfind("]")
        if start_arr != -1 and end_arr != -1 and end_arr > start_arr:
            try:
                parsed = json.loads(text[start_arr : end_arr + 1])
            except Exception:
                pass

    if parsed is None:
        start_obj = text.find("{")
        end_obj = text.rfind("}")
        if start_obj != -1 and end_obj != -1 and end_obj > start_obj:
            try:
                parsed = json.loads(text[start_obj : end_obj + 1])
            except Exception:
                pass

    if parsed is None:
        return []

    if isinstance(parsed, dict):
        for k in ("items", "foods", "food_items", "detected", "result", "dishes"):
            if k in parsed and isinstance(parsed[k], list):
                parsed = parsed[k]
                break
        else:
            parsed = [parsed]

    if not isinstance(parsed, list):
        return []

    out: list[DetectedItem] = []
    for it in parsed:
        if not isinstance(it, dict):
            continue
        raw_name = (
            it.get("name")
            or it.get("food")
            or it.get("dish")
            or it.get("item")
            or it.get("label")
            or it.get("food_name")
            or ""
        )
        name = str(raw_name).strip()
        if not name:
            continue
        raw_bn = (
            it.get("name_bn")
            or it.get("bengali_name")
            or it.get("name_bengali")
            or ""
        )
        name_bn = str(raw_bn).strip() or None
        try:
            confidence = float(it.get("confidence", 0))
            if 0.0 < confidence <= 1.0:
                confidence *= 100.0
        except (TypeError, ValueError):
            confidence = 85.0
        try:
            grams = float(it.get("grams", 0))
            if grams <= 0:
                grams = 150.0
        except (TypeError, ValueError):
            grams = 150.0

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


def _extract_text(payload: dict[str, Any]) -> str:
    """Pull the text content out of a Gemini response, logging safety blocks if encountered."""
    candidates = payload.get("candidates") or []
    if candidates:
        candidate = candidates[0] or {}
        finish_reason = candidate.get("finishReason")
        if finish_reason and finish_reason not in ("STOP", "MAX_TOKENS"):
            log.warning("Gemini candidate finishReason is %s", finish_reason)
        content = candidate.get("content") or {}
        parts = content.get("parts") or []
        if parts and isinstance(parts[0], dict):
            text = parts[0].get("text")
            if isinstance(text, str):
                return text
    text = payload.get("text")
    return text if isinstance(text, str) else ""
