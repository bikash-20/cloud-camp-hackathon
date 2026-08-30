"""JSON-file-backed in-memory state store.

Cut (a) doesn't need SQLite. The skeleton proves persistence by
reading/writing `state.json` on every mutation. This is intentionally
not a database — the point of cut (a) is the **contract**, not the
storage layer.

The store is held as a process-wide singleton so FastAPI's
dependency-injection gets the same instance on every request. The
`save()` call rewrites the entire file; this is fine for demo-scale
data (single user, <100 meals, <100 grocery items).
"""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.models.schemas import (
    DetectedItem,
    GroceryItem,
    HealthGoals,
    MealEntry,
    MealTotals,
    UserProfile,
)
from app.seed.fixtures import DEFAULT_PROFILE, default_grocery_items


class StateError(ValueError):
    """Raised when a mutation references an unknown entity id."""


class State:
    """Thread-safe in-memory store with JSON persistence."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.RLock()
        self._profile: UserProfile = DEFAULT_PROFILE.model_copy(deep=True)
        self._meals: list[MealEntry] = []
        self._grocery: list[GroceryItem] = default_grocery_items()
        self._grocery_next_id: int = self._max_grocery_id() + 1

    # ── Persistence ──────────────────────────────────────────────────────

    def load(self) -> None:
        """Read state.json from disk. Seeds defaults if file is missing
        or corrupt — never crashes on first boot."""
        with self._lock:
            if not self.path.exists():
                self._write_unlocked()
                return
            try:
                raw = json.loads(self.path.read_text())
            except (OSError, json.JSONDecodeError):
                return  # corrupt file — keep in-memory defaults
            try:
                self._profile = UserProfile.model_validate(raw.get("profile", {}))
            except Exception:
                pass
            try:
                self._meals = [
                    MealEntry.model_validate(m) for m in raw.get("meals", [])
                ]
            except Exception:
                pass
            try:
                self._grocery = [
                    GroceryItem.model_validate(g) for g in raw.get("grocery", [])
                ]
            except Exception:
                pass
            self._grocery_next_id = self._max_grocery_id() + 1

    def save(self) -> None:
        """Rewrite state.json from in-memory state. No-op if the file is
        already up-to-date — keeps I/O down on hot paths."""
        with self._lock:
            self._write_unlocked()

    def _write_unlocked(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "profile": self._profile.model_dump(mode="json", by_alias=True),
            "meals": [m.model_dump(mode="json", by_alias=True) for m in self._meals],
            "grocery": [
                g.model_dump(mode="json", by_alias=True) for g in self._grocery
            ],
        }
        self.path.write_text(json.dumps(payload, indent=2, sort_keys=True))

    def _max_grocery_id(self) -> int:
        """Find the highest numeric suffix in existing grocery ids so
        new items don't collide with seeded ones like 'g-0-0'."""
        max_n = 0
        for item in self._grocery:
            digits = "".join(c for c in item.id if c.isdigit())
            if digits:
                n = int(digits)
                if n > max_n:
                    max_n = n
        return max_n

    # ── Profile ──────────────────────────────────────────────────────────

    def get_profile(self) -> UserProfile:
        with self._lock:
            return self._profile.model_copy(deep=True)

    def set_profile(self, profile: UserProfile) -> UserProfile:
        with self._lock:
            self._profile = profile.model_copy(deep=True)
            self._write_unlocked()
            return self._profile.model_copy(deep=True)

    # ── Meals ─────────────────────────────────────────────────────────────

    def list_meals(self) -> list[MealEntry]:
        with self._lock:
            return [m.model_copy(deep=True) for m in self._meals]

    def add_meal(
        self,
        *,
        label: str,
        items: list[DetectedItem],
        totals: MealTotals,
        photo_url: str | None,
        active_goals: HealthGoals,
    ) -> MealEntry:
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        entry = MealEntry(
            id=f"meal-{uuid.uuid4().hex[:12]}",
            date=now,
            label=label,
            items=[i.model_copy(deep=True) for i in items],
            totals=totals.model_copy(deep=True),
            photo_url=photo_url,
            active_goals=active_goals.model_copy(deep=True),
        )
        with self._lock:
            self._meals.insert(0, entry)
            self._write_unlocked()
            return entry.model_copy(deep=True)

    def delete_meal(self, meal_id: str) -> None:
        with self._lock:
            before = len(self._meals)
            self._meals = [m for m in self._meals if m.id != meal_id]
            if len(self._meals) == before:
                raise StateError(f"unknown meal id: {meal_id}")
            self._write_unlocked()

    # ── Grocery ──────────────────────────────────────────────────────────

    def list_grocery(self) -> list[GroceryItem]:
        with self._lock:
            return [g.model_copy(deep=True) for g in self._grocery]

    def add_grocery(self, name: str, price: float) -> GroceryItem:
        item = GroceryItem(
            id=f"g-new-{self._grocery_next_id}",
            name=name,
            price=max(0.0, price),
            checked=False,
        )
        with self._lock:
            self._grocery.append(item)
            self._grocery_next_id += 1
            self._write_unlocked()
            return item.model_copy(deep=True)

    def remove_grocery(self, item_id: str) -> None:
        with self._lock:
            before = len(self._grocery)
            self._grocery = [g for g in self._grocery if g.id != item_id]
            if len(self._grocery) == before:
                raise StateError(f"unknown grocery id: {item_id}")
            self._write_unlocked()

    def update_grocery_price(self, item_id: str, price: float) -> GroceryItem:
        with self._lock:
            for g in self._grocery:
                if g.id == item_id:
                    g.price = max(0.0, min(9999.0, price))
                    self._write_unlocked()
                    return g.model_copy(deep=True)
            raise StateError(f"unknown grocery id: {item_id}")

    def toggle_grocery(self, item_id: str) -> GroceryItem:
        with self._lock:
            for g in self._grocery:
                if g.id == item_id:
                    g.checked = not g.checked
                    self._write_unlocked()
                    return g.model_copy(deep=True)
            raise StateError(f"unknown grocery id: {item_id}")

    def clear_grocery(self) -> None:
        with self._lock:
            self._grocery = []
            self._write_unlocked()


# ── Process-wide singleton ──────────────────────────────────────────────
#
# Initialized once when `app.main:create_app()` runs; resolved via the
# `get_state()` FastAPI dependency on every request.

_state: State | None = None


def init_state(path: Path) -> State:
    """Create the singleton (or return the existing one). Called once
    at app startup with the path resolved from env."""
    global _state
    if _state is None:
        _state = State(path)
        _state.load()
    return _state


def get_state() -> State:
    """FastAPI dependency that hands the singleton to a route handler.
    Raises at request time if the app was misconfigured (init_state
    wasn't called at startup)."""
    if _state is None:
        raise RuntimeError(
            "State singleton not initialized — call init_state(path) "
            "during FastAPI startup."
        )
    return _state
