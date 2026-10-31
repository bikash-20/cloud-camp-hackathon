"""Text-to-Speech (TTS) Service using ElevenLabs with ultra-low latency & zero-crash fallback.

Features:
- Configurable model (ELEVENLABS_MODEL_ID), defaulting to `eleven_flash_v2_5` for ~75ms TTFA.
- In-memory LRU cache for frequent greetings and short phrases to conserve character quota.
- Clean text sanitizer ensuring speech output is stripped of Markdown, asterisks, emojis, and KaTeX.
- Graceful degradation: If ElevenLabs API key is absent, depleted, or fails, gracefully signals
  `use_browser_tts = True` without raising 500 errors.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import threading
from typing import Tuple

import httpx

log = logging.getLogger(__name__)

ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech"
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" — universally balanced, clear conversational voice
DEFAULT_MODEL_ID = "eleven_flash_v2_5"  # ~75ms TTFA, 50% cheaper character cost
MULTILINGUAL_MODEL_ID = "eleven_multilingual_v2"  # Full native Bengali script support

# Max items stored in memory
MAX_CACHE_SIZE = 128


def sanitize_for_speech(text: str) -> str:
    """Strip Markdown, asterisks, bullet points, emojis, URLs, and KaTeX notations for clean TTS audio."""
    if not text:
        return ""

    cleaned = text.strip()

    # If response includes dual-channel delimiter, extract the voice summary portion
    if "===VOICE_SUMMARY===" in cleaned:
        cleaned = cleaned.split("===VOICE_SUMMARY===", 1)[1].strip()

    # Remove URLs
    cleaned = re.sub(r"https?://\S+|www\.\S+", "", cleaned)

    # Remove Markdown links [Label](url) -> Label
    cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)

    # Remove KaTeX block math $$...$$ and inline $...$ or \(...\)
    cleaned = re.sub(r"\$\$[^\$]+\$\$", "", cleaned)
    cleaned = re.sub(r"\$[^\$]+\$", "", cleaned)
    cleaned = re.sub(r"\\\([^\)]+\\\)", "", cleaned)
    cleaned = re.sub(r"\\[a-zA-Z]+(\{[^}]*\})?", "", cleaned)

    # Remove markdown formatting characters: *, _, ~, `, #, >, |
    cleaned = re.sub(r"[*_~`#>|]", "", cleaned)

    # Replace bullet markers at start of lines
    cleaned = re.sub(r"^\s*[-•]\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*\d+\.\s*", "", cleaned, flags=re.MULTILINE)

    # Strip common emojis (Unicode ranges)
    emoji_pattern = re.compile(
        "["
        "\U0001f600-\U0001f64f"  # emoticons
        "\U0001f300-\U0001f5ff"  # symbols & pictographs
        "\U0001f680-\U0001f6ff"  # transport & map
        "\U0001f1e0-\U0001f1ff"  # flags (iOS)
        "\U00002702-\U000027b0"
        "\U000024c2-\U0001f251"
        "\U0001f900-\U0001f9ff"  # supplemental symbols
        "\U0001fa70-\U0001faff"
        "]+",
        flags=re.UNICODE,
    )
    cleaned = emoji_pattern.sub("", cleaned)

    # Collapse multiple whitespaces and newlines
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Cap to ~350 characters (2 to 3 concise spoken sentences) to keep TTFA under 500ms
    if len(cleaned) > 400:
        sentences = re.split(r"(?<=[.!?।])\s+", cleaned)
        truncated = ""
        for s in sentences:
            if len(truncated) + len(s) < 350:
                truncated += (" " if truncated else "") + s
            else:
                break
        cleaned = truncated or cleaned[:350].rsplit(" ", 1)[0] + "."

    return cleaned


class TTSService:
    """Manages audio generation with ElevenLabs, local caching, and fallback logic."""

    def __init__(
        self,
        api_key: str | None = None,
        voice_id: str | None = None,
        model_id: str | None = None,
    ) -> None:
        self._initial_api_key = api_key
        self._initial_voice_id = voice_id
        self._initial_model_id = model_id
        self._cache: dict[str, bytes] = {}
        self._lock = threading.Lock()

    @property
    def api_key(self) -> str:
        """Dynamic resolution: constructor override -> os.environ -> empty string."""
        if self._initial_api_key is not None:
            return self._initial_api_key.strip()
        return (os.environ.get("ELEVENLABS_API_KEY") or "").strip()

    @api_key.setter
    def api_key(self, val: str | None) -> None:
        self._initial_api_key = val

    @property
    def voice_id(self) -> str:
        """Dynamic resolution: constructor override -> os.environ -> DEFAULT_VOICE_ID."""
        if self._initial_voice_id is not None:
            return self._initial_voice_id.strip()
        return (os.environ.get("ELEVENLABS_VOICE_ID") or DEFAULT_VOICE_ID).strip()

    @voice_id.setter
    def voice_id(self, val: str | None) -> None:
        self._initial_voice_id = val

    @property
    def model_id(self) -> str:
        """Dynamic resolution: constructor override -> os.environ -> DEFAULT_MODEL_ID."""
        if self._initial_model_id is not None:
            return self._initial_model_id.strip()
        return (os.environ.get("ELEVENLABS_MODEL_ID") or DEFAULT_MODEL_ID).strip()

    @model_id.setter
    def model_id(self, val: str | None) -> None:
        self._initial_model_id = val

    def _cache_key(self, text: str, voice_id: str, model_id: str) -> str:
        raw = f"{voice_id}:{model_id}:{text.strip().lower()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def is_configured(self) -> bool:
        """Return True if an ElevenLabs API key is configured."""
        return bool(self.api_key)

    def synthesize(
        self,
        text: str,
        lang: str = "en",
        voice_id: str | None = None,
        model_id: str | None = None,
        timeout: float = 6.0,
    ) -> Tuple[bytes | None, str, bool, str]:
        """Synthesize text into MP3 audio.

        Returns:
            (audio_bytes, mime_type, use_browser_tts, tts_diagnostic)
            If synthesis succeeds: (bytes, "audio/mpeg", False, "ok")
            If degraded/unconfigured: (None, "audio/mpeg", True, "<diagnostic>")
        """
        clean_text = sanitize_for_speech(text)
        if not clean_text:
            return None, "audio/mpeg", True, "empty_text"

        # Check configuration dynamically at request time
        if not self.is_configured():
            log.debug("ElevenLabs API key not set; falling back to browser TTS.")
            return None, "audio/mpeg", True, "missing_api_key"

        active_voice = voice_id or self.voice_id or DEFAULT_VOICE_ID

        # Automatic language-aware model selection:
        # ElevenLabs Flash v2.5 delivers ultra-low ~75ms TTFA for English, but Bengali script
        # requires eleven_multilingual_v2 for authentic phonetics and pronunciation.
        has_bengali_script = bool(re.search(r"[\u0980-\u09FF]", clean_text))
        active_model = model_id or self.model_id
        if has_bengali_script or lang == "bn":
            if active_model not in (MULTILINGUAL_MODEL_ID, "eleven_v3"):
                active_model = MULTILINGUAL_MODEL_ID

        ckey = self._cache_key(clean_text, active_voice, active_model)
        with self._lock:
            if ckey in self._cache:
                log.debug("TTS cache hit for prompt hash %s", ckey[:8])
                return self._cache[ckey], "audio/mpeg", False, "ok (cache_hit)"

        url = f"{ELEVENLABS_API_URL}/{active_voice}?optimize_streaming_latency=3"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key,
        }
        payload = {
            "text": clean_text,
            "model_id": active_model,
            "voice_settings": {
                "stability": 0.50,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }

        try:
            with httpx.Client(timeout=timeout) as client:
                res = client.post(url, headers=headers, json=payload)
                if res.status_code == 200 and len(res.content) > 0:
                    audio_bytes = res.content
                    with self._lock:
                        if len(self._cache) >= MAX_CACHE_SIZE:
                            # Pop oldest key
                            self._cache.pop(next(iter(self._cache)))
                        self._cache[ckey] = audio_bytes
                    return audio_bytes, "audio/mpeg", False, "ok"

                err_detail = ""
                try:
                    err_json = res.json()
                    detail_val = err_json.get("detail", {})
                    if isinstance(detail_val, dict):
                        err_detail = detail_val.get("message") or str(detail_val)
                    else:
                        err_detail = str(detail_val)
                except Exception:
                    err_detail = res.text[:200]

                diag = f"elevenlabs_http_{res.status_code}: {err_detail}".strip()
                log.warning(
                    "ElevenLabs TTS returned HTTP %d: %s. Gracefully degrading to browser TTS.",
                    res.status_code,
                    err_detail,
                )
                return None, "audio/mpeg", True, diag
        except Exception as exc:
            diag = f"elevenlabs_exception: {type(exc).__name__}: {exc}"
            log.warning("ElevenLabs TTS request failed (%s). Gracefully degrading to browser TTS.", exc)
            return None, "audio/mpeg", True, diag


# Global singleton instance
_tts_service: TTSService | None = None


def get_tts_service() -> TTSService:
    """Return the global TTSService singleton."""
    global _tts_service
    if _tts_service is None:
        _tts_service = TTSService()
    return _tts_service
