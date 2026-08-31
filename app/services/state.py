"""JSON-file-backed in-memory state store.

Cut (a) doesn't need SQLite. The skeleton proves persistence by
reading/writing `state.json` on every mutation. This is intentionally
not a database — cut (b) swaps in SQLite behind the same interface.

`State` is a process-wide singleton resolved by `get_state()`. Each
collection (profile, meals, grocery) is a `Bucket` — a thin wrapper
around `list[X]` + `dict[id, X]` for O(1) lookups + ordered iteration.

Mutations go through the `_bucket(B).upsert / .remove` helpers; every
mutation rewrites the file. The file rewrite is fine for demo-scale
data (single user, <100 meals, <100 grocery items).
"""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Generic, TypeVar

from app.models.schemas import (
    DetectedItem,
    GroceryItem,
    HealthGoals,
    MealEntry,
    MealTotals,
    UserProfile,
)
from app.seed.fixtures import DEFAULT_PROFILE, default_grocery_items


T = TypeVar("T")


class StateError(ValueError):
    """Raised when a mutation references an unknown entity id."""


class Bucket(Generic[T]):
    """An ordered, indexed collection of items keyed by `.id`.

    `items` keeps insertion order — the public list endpoint just
    iterates this. Mutations go through `upsert` / `remove` so the
    state file can be re-written after every change.

    The factory builds an item when the caller doesn't supply an id
    (e.g. a new `GroceryItem` needs a fresh "g-new-N" id; a new
    `MealEntry` needs a server-stamped id + date).
    """

    def __init__(
        self,
        factory: Callable[[], T] | None = None,
        *,
        newest_first: bool = False,
    ) -> None:
        self.items: list[T] = []
        self.factory = factory
        self.newest_first = newest_first

    def by_id(self) -> dict[str, T]:
        return {getattr(x, "id"): x for x in self.items}

    def upsert(self, item: T, *, index: int | None = None) -> T:
        if index is None:
            index = 0 if self.newest_first else len(self.items)
        self.items.insert(index, item)
        return item

    def remove(self, item_id: str) -> None:
        before = len(self.items)
        self.items = [x for x in self.items if getattr(x, "id") != item_id]
        if len(self.items) == before:
            raise StateError(f"unknown id: {item_id}")


class State:
    """Thread-safe in-memory store with JSON persistence."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.RLock()
        self.profile: UserProfile = DEFAULT_PROFILE.model_copy(deep=True)
        self.meals = Bucket[MealEntry](newest_first=True)
        self.grocery = Bucket[GroceryItem]()
        self._seed_grocery()

    def _seed_grocery(self) -> None:
        for item in default_grocery_items():
            self.grocery.items.append(item.model_copy(deep=True))
        self._save_unlocked()

    # ── Persistence ──────────────────────────────────────────────────────

    def load(self) -> None:
        """Read state.json from disk. Seeds defaults if the file is
        missing or corrupt — never crashes on first boot."""
        if not self.path.exists():
            self._save_unlocked()
            return
        try:
            raw = json.loads(self.path.read_text())
        except (OSError, json.JSONDecodeError):
            return
        try:
            self.profile = UserProfile.model_validate(raw.get("profile", {}))
        except Exception:
            pass
        self.meals.items = self._parse_list(raw, "meals", MealEntry)
        self.grocery.items = self._parse_list(raw, "grocery", GroceryItem)

    def _parse_list(self, raw: dict, key: str, model: type[T]) -> list[T]:
        try:
            return [model.model_validate(x) for x in raw.get(key, [])]
        except Exception:
            return []

    def _save_unlocked(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "profile": self.profile.model_dump(mode="json", by_alias=True),
            "meals": [m.model_dump(mode="json", by_alias=True) for m in self.meals.items],
            "grocery": [
                g.model_dump(mode="json", by_alias=True) for g in self.grocery.items
            ],
        }
        self.path.write_text(json.dumps(payload, indent=2, sort_keys=True))

    def _mutate(self, mutate: Callable[[], object]) -> object:
        """Run `mutate` under the lock and persist afterwards."""
        with self._lock:
            result = mutate()
            self._save_unlocked()
            return result

    # ── Profile ──────────────────────────────────────────────────────────

    def get_profile(self) -> UserProfile:
        with self._lock:
            return self.profile.model_copy(deep=True)

    def set_profile(self, profile: UserProfile) -> UserProfile:
        return self._mutate(
            lambda: setattr(self, "profile", profile.model_copy(deep=True))
            or self.profile.model_copy(deep=True)
        )

    # ── Meals ─────────────────────────────────────────────────────────────

    def list_meals(self) -> list[MealEntry]:
        with self._lock:
            return [m.model_copy(deep=True) for m in self.meals.items]

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

        def add() -> MealEntry:
            self.meals.upsert(entry)
            return entry.model_copy(deep=True)

        return self._mutate(add)

    def delete_meal(self, meal_id: str) -> None:
        self._mutate(lambda: self.meals.remove(meal_id))

    # ── Grocery ──────────────────────────────────────────────────────────

    def _next_grocery_id(self) -> str:
        max_n = max(
            (int("".join(c for c in g.id if c.isdigit()) or 0)
             for g in self.grocery.items),
            default=0,
        )
        return f"g-new-{max_n + 1}"

    def list_grocery(self) -> list[GroceryItem]:
        with self._lock:
            return [g.model_copy(deep=True) for g in self.grocery.items]

    def add_grocery(self, name: str, price: float) -> GroceryItem:
        item = GroceryItem(
            id=self._next_grocery_id(), name=name,
            price=max(0.0, price), checked=False,
        )
        return self._mutate(lambda: self.grocery.upsert(item) or item.model_copy(deep=True))

    def remove_grocery(self, item_id: str) -> None:
        self._mutate(lambda: self.grocery.remove(item_id))

    def update_grocery_price(self, item_id: str, price: float) -> GroceryItem:
        def update() -> GroceryItem:
            for g in self.grocery.items:
                if g.id == item_id:
                    g.price = max(0.0, min(9999.0, price))
                    return g.model_copy(deep=True)
            raise StateError(f"unknown grocery id: {item_id}")
        return self._mutate(update)

    def toggle_grocery(self, item_id: str) -> GroceryItem:
        def toggle() -> GroceryItem:
            for g in self.grocery.items:
                if g.id == item_id:
                    g.checked = not g.checked
                    return g.model_copy(deep=True)
            raise StateError(f"unknown grocery id: {item_id}")
        return self._mutate(toggle)

    def clear_grocery(self) -> None:
        self._mutate(lambda: self.grocery.items.clear())


# ── Process-wide singleton ──────────────────────────────────────────────


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
    """FastAPI dependency that hands the singleton to a route handler."""
    if _state is None:
        raise RuntimeError(
            "State singleton not initialized — call init_state(path) "
            "during FastAPI startup."
        )
    return _state
