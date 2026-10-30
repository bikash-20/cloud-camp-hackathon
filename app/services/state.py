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
    AdminMetrics,
    AdminUserSummary,
    DetectedItem,
    GroceryItem,
    HealthGoals,
    MealEntry,
    MealTotals,
    Role,
    UserProfile,
)
from app.seed.fixtures import DEFAULT_PROFILE, default_grocery_items


T = TypeVar("T")


class StateError(ValueError):
    """Raised when a mutation references an unknown entity id."""


class UserData:
    """Per-user data partition: profile, meals, grocery."""

    def __init__(
        self,
        email: str,
        name: str | None = None,
        role: Role = "user",
        joined_date: str | None = None,
        last_active: str | None = None,
    ) -> None:
        self.email = email.lower().strip()
        self.name = name or self.email.split("@")[0]
        self.role: Role = role
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        self.joined_date = joined_date or now
        self.last_active = last_active or now
        self.profile = DEFAULT_PROFILE.model_copy(deep=True)
        self.profile.name = self.name
        self.meals = Bucket[MealEntry](newest_first=True)
        self.grocery = Bucket[GroceryItem]()
        self._seed_grocery()

    def _seed_grocery(self) -> None:
        for item in default_grocery_items():
            self.grocery.items.append(item.model_copy(deep=True))


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
    """Thread-safe in-memory store with JSON persistence and multi-user partitioning."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.RLock()
        self.profile: UserProfile = DEFAULT_PROFILE.model_copy(deep=True)
        self.meals = Bucket[MealEntry](newest_first=True)
        self.grocery = Bucket[GroceryItem]()
        self.users: dict[str, UserData] = {}
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

        raw_users = raw.get("users", {})
        if isinstance(raw_users, dict):
            for email, udict in raw_users.items():
                try:
                    udata = UserData(
                        email=email,
                        name=udict.get("name"),
                        role=udict.get("role", "user"),
                        joined_date=udict.get("joined_date"),
                        last_active=udict.get("last_active"),
                    )
                    if "profile" in udict:
                        udata.profile = UserProfile.model_validate(udict["profile"])
                    udata.meals.items = self._parse_list(udict, "meals", MealEntry)
                    if "grocery" in udict:
                        udata.grocery.items = self._parse_list(udict, "grocery", GroceryItem)
                    self.users[email.lower().strip()] = udata
                except Exception:
                    pass

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
            "users": {
                email: {
                    "email": u.email,
                    "name": u.name,
                    "role": u.role,
                    "joined_date": u.joined_date,
                    "last_active": u.last_active,
                    "profile": u.profile.model_dump(mode="json", by_alias=True),
                    "meals": [m.model_dump(mode="json", by_alias=True) for m in u.meals.items],
                    "grocery": [g.model_dump(mode="json", by_alias=True) for g in u.grocery.items],
                }
                for email, u in self.users.items()
            },
        }
        self.path.write_text(json.dumps(payload, indent=2, sort_keys=True))

    def _mutate(self, mutate: Callable[[], object]) -> object:
        """Run `mutate` under the lock and persist afterwards."""
        with self._lock:
            result = mutate()
            self._save_unlocked()
            return result

    # ── User Account Partitioning ─────────────────────────────────────────

    def get_or_create_user(
        self,
        email: str,
        name: str | None = None,
        role: Role = "user",
    ) -> UserData:
        clean_email = email.lower().strip()
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        def op() -> UserData:
            if clean_email not in self.users:
                self.users[clean_email] = UserData(
                    email=clean_email,
                    name=name,
                    role=role,
                    joined_date=now,
                    last_active=now,
                )
            else:
                user = self.users[clean_email]
                user.last_active = now
                if name and (not user.name or user.name == clean_email.split("@")[0]):
                    user.name = name
                    user.profile.name = name
                if role == "admin":
                    user.role = "admin"
            return self.users[clean_email]

        return self._mutate(op)  # type: ignore[return-value]

    def get_user_profile(self, email: str) -> UserProfile:
        with self._lock:
            user = self.users.get(email.lower().strip())
            if user:
                return user.profile.model_copy(deep=True)
            return self.profile.model_copy(deep=True)

    def set_user_profile(self, email: str, profile: UserProfile) -> UserProfile:
        clean_email = email.lower().strip()

        def op() -> UserProfile:
            user = self.users.get(clean_email)
            if not user:
                user = UserData(email=clean_email, name=profile.name)
                self.users[clean_email] = user
            user.profile = profile.model_copy(deep=True)
            user.last_active = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            return user.profile.model_copy(deep=True)

        return self._mutate(op)  # type: ignore[return-value]

    def list_user_meals(self, email: str) -> list[MealEntry]:
        with self._lock:
            user = self.users.get(email.lower().strip())
            if user:
                return [m.model_copy(deep=True) for m in user.meals.items]
            return self.list_meals()

    def add_user_meal(
        self,
        email: str,
        *,
        label: str,
        items: list[DetectedItem],
        totals: MealTotals,
        photo_url: str | None,
        active_goals: HealthGoals,
    ) -> MealEntry:
        clean_email = email.lower().strip()
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

        def op() -> MealEntry:
            user = self.users.get(clean_email)
            if not user:
                user = UserData(email=clean_email)
                self.users[clean_email] = user
            user.meals.upsert(entry)
            user.last_active = now
            return entry.model_copy(deep=True)

        return self._mutate(op)  # type: ignore[return-value]

    def delete_user_meal(self, email: str, meal_id: str) -> None:
        clean_email = email.lower().strip()

        def op() -> None:
            user = self.users.get(clean_email)
            if user:
                user.meals.remove(meal_id)
            else:
                self.meals.remove(meal_id)

        self._mutate(op)

    def list_user_grocery(self, email: str) -> list[GroceryItem]:
        with self._lock:
            user = self.users.get(email.lower().strip())
            if user:
                return [g.model_copy(deep=True) for g in user.grocery.items]
            return self.list_grocery()

    def add_user_grocery(self, email: str, name: str, price: float) -> GroceryItem:
        clean_email = email.lower().strip()

        def op() -> GroceryItem:
            user = self.users.get(clean_email)
            if not user:
                user = UserData(email=clean_email)
                self.users[clean_email] = user
            max_n = max(
                (int("".join(c for c in g.id if c.isdigit()) or 0) for g in user.grocery.items),
                default=0,
            )
            item = GroceryItem(
                id=f"g-new-{max_n + 1}",
                name=name,
                price=max(0.0, price),
                checked=False,
            )
            user.grocery.upsert(item)
            return item.model_copy(deep=True)

        return self._mutate(op)  # type: ignore[return-value]

    def remove_user_grocery(self, email: str, item_id: str) -> None:
        clean_email = email.lower().strip()

        def op() -> None:
            user = self.users.get(clean_email)
            if user:
                user.grocery.remove(item_id)
            else:
                self.grocery.remove(item_id)

        self._mutate(op)

    def update_user_grocery_price(self, email: str, item_id: str, price: float) -> GroceryItem:
        clean_email = email.lower().strip()

        def op() -> GroceryItem:
            user = self.users.get(clean_email)
            target_list = user.grocery.items if user else self.grocery.items
            for g in target_list:
                if g.id == item_id:
                    g.price = max(0.0, min(9999.0, price))
                    return g.model_copy(deep=True)
            raise StateError(f"unknown grocery id: {item_id}")

        return self._mutate(op)  # type: ignore[return-value]

    def toggle_user_grocery(self, email: str, item_id: str) -> GroceryItem:
        clean_email = email.lower().strip()

        def op() -> GroceryItem:
            user = self.users.get(clean_email)
            target_list = user.grocery.items if user else self.grocery.items
            for g in target_list:
                if g.id == item_id:
                    g.checked = not g.checked
                    return g.model_copy(deep=True)
            raise StateError(f"unknown grocery id: {item_id}")

        return self._mutate(op)  # type: ignore[return-value]

    def clear_user_grocery(self, email: str) -> None:
        clean_email = email.lower().strip()

        def op() -> None:
            user = self.users.get(clean_email)
            if user:
                user.grocery.items.clear()
            else:
                self.grocery.items.clear()

        self._mutate(op)

    # ── Admin Analytics Aggregation ──────────────────────────────────────

    def get_admin_metrics(self) -> AdminMetrics:
        with self._lock:
            all_users_list = list(self.users.values())
            all_meals: list[MealEntry] = list(self.meals.items)
            for u in all_users_list:
                all_meals.extend(u.meals.items)

            now = datetime.now(timezone.utc)
            today_str = now.strftime("%Y-%m-%d")
            seven_days_ago_ts = now.timestamp() - (7 * 86400)

            meals_today = 0
            meals_this_week = 0
            flagged_items = 0
            total_items = 0

            for m in all_meals:
                if m.date.startswith(today_str):
                    meals_today += 1
                try:
                    dt = datetime.fromisoformat(m.date.replace("Z", "+00:00"))
                    if dt.timestamp() >= seven_days_ago_ts:
                        meals_this_week += 1
                except Exception:
                    pass

                for it in m.items:
                    total_items += 1
                    if it.confidence < 70.0:
                        flagged_items += 1

            total_users_count = max(1, len(self.users))
            avg_meals = round(meals_this_week / total_users_count, 1)
            flagged_pct = round((flagged_items / total_items * 100), 1) if total_items > 0 else 0.0

            summaries: list[AdminUserSummary] = [
                AdminUserSummary(
                    email=u.email,
                    name=u.name,
                    role=u.role,
                    meals_count=len(u.meals.items),
                    joined_date=u.joined_date,
                    last_active=u.last_active,
                )
                for u in all_users_list
            ]

            return AdminMetrics(
                total_users=len(self.users),
                meals_today=meals_today,
                meals_this_week=meals_this_week,
                avg_meals_per_user=avg_meals,
                flagged_percentage=flagged_pct,
                users=summaries,
            )

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
