"""Reconcile tests — Gemini + HF confidence-weighted vote."""

from __future__ import annotations

from app.models.schemas import DetectedItem
from app.services.reconcile import merge


def test_both_agree_takes_higher_confidence() -> None:
    """Gemini says 'Chicken biryani' at 92, HF says 'chicken biryani'
    at 0.95 (= 95). HF is higher → HF's label wins (and HF labels
    are normalized to title case)."""
    gemini = [DetectedItem(name="Chicken biryani", confidence=92, grams=310)]
    hf = [("chicken_biryani", 0.95)]
    out = merge(gemini, hf)
    assert len(out) == 1
    # HF confidence wins (95 > 92); HF's normalized title-cased label is
    # "Chicken Biryani" (first underscore-split token → title).
    assert out[0].confidence == 95.0
    assert "biryani" in out[0].name.lower()


def test_gemini_only_passes_through() -> None:
    """No HF label matches → Gemini items pass through unchanged."""
    gemini = [
        DetectedItem(name="Mystery gizmo", confidence=80, grams=100),
    ]
    out = merge(gemini, [])
    assert len(out) == 1
    assert out[0].name == "Mystery gizmo"
    assert out[0].confidence == 80


def test_hf_only_gets_scaled_to_0_100() -> None:
    """HF labels without a Gemini match are kept and their score is
    scaled to 0–100 via × 100."""
    out = merge([], [("tomato_soup", 0.42)])
    assert len(out) == 1
    assert out[0].confidence == 42.0
    assert "tomato" in out[0].name.lower()


def test_disagreement_keeps_both() -> None:
    """Gemini and HF disagree on a food → both items kept."""
    gemini = [DetectedItem(name="Roti", confidence=80, grams=50)]
    hf = [("chicken_curry", 0.60), ("dal_makhani", 0.40)]
    out = merge(gemini, hf)
    assert len(out) == 3  # 1 Gemini + 2 HF
    names_l = {x.name.lower() for x in out}
    assert "roti" in names_l
    assert any("chicken" in n for n in names_l)
    assert any("dal" in n for n in names_l)


def test_empty_both_returns_empty() -> None:
    out = merge([], [])
    assert out == []


def test_substring_match_handles_typo() -> None:
    """Case-insensitive substring match means HF's 'chicken_biryani'
    matches Gemini's 'chicken biryani rice' (one is a substring of the other)."""
    gemini = [DetectedItem(name="chicken biryani rice", confidence=70, grams=200)]
    hf = [("chicken_biryani", 0.80)]
    out = merge(gemini, hf)
    assert len(out) == 1
    # HF score 80 > 70 → HF wins; the label is normalized to title case.
    assert out[0].confidence == 80.0


def test_unused_hf_label_is_kept() -> None:
    """An HF label that doesn't match any Gemini item is appended, not dropped."""
    gemini = [DetectedItem(name="Rice", confidence=90, grams=150)]
    hf = [("rice_steamed", 0.85), ("chicken_tikka", 0.30)]
    out = merge(gemini, hf)
    # Rice ↔ rice_steamed (matched). chicken_tikka kept as HF-only.
    assert len(out) == 2
    names_l = [x.name.lower() for x in out]
    assert any("chicken" in n for n in names_l)
