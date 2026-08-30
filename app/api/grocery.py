"""Grocery list CRUD — mirrors `src/lib/api.ts#getGroceryList`,
`addGroceryItem`, `removeGroceryItem`, `updateGroceryPrice`,
`toggleGroceryItem`, `clearGroceryList`.

The frontend bucket-by-category logic lives in
`bucketGroceryByCategory`; here it's a sibling helper that preserves
the same behavior so the Grocery screen renders identically.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.models.schemas import GroceryGroup, GroceryItem, GroceryList
from app.seed.fixtures import DEFAULT_GROCERY_GROUPS
from app.services.state import State, get_state


router = APIRouter(prefix="/api/grocery", tags=["grocery"])


# ── Helpers ──────────────────────────────────────────────────────────────


def _bucket_grocery_by_category(items: list[GroceryItem]) -> list[GroceryGroup]:
    """Mirror of the frontend's `bucketGroceryByCategory`:
    seeded ids (`g-0-0`, `g-1-2`, …) keep their original category from
    `DEFAULT_GROCERY_GROUPS`; custom items (`g-new-*`) land in `Other`,
    appended only when non-empty.
    """
    id_to_cat: dict[str, str] = {}
    for group in DEFAULT_GROCERY_GROUPS:
        for item in group.items:
            id_to_cat[item.id] = group.category

    out: list[GroceryGroup] = [
        GroceryGroup(category=g.category, items=[]) for g in DEFAULT_GROCERY_GROUPS
    ]
    other: list[GroceryItem] = []
    for item in items:
        cat = id_to_cat.get(item.id)
        if cat is not None:
            target = next((g for g in out if g.category == cat), None)
            if target is not None:
                target.items.append(item)
            else:
                other.append(item)
        else:
            other.append(item)
    if other:
        out.append(GroceryGroup(category="Other", items=other))
    return out


# ── Request/response bodies ──────────────────────────────────────────────


class AddGroceryRequest(BaseModel):
    name: str
    price: float = Field(ge=0)
    # Category is informational only — backend doesn't bucket new items
    # by it; they always land in `Other` until re-categorized. Kept on
    # the request so the frontend's existing call shape works without
    # any frontend edits.
    category: str = "Other"


class UpdatePriceRequest(BaseModel):
    price: float = Field(ge=0, le=9999)


# ── Endpoints ────────────────────────────────────────────────────────────


@router.get("", response_model=GroceryList)
def get_grocery_list(
    budget: float = Query(..., ge=0),
    state: State = Depends(get_state),
) -> GroceryList:
    """Return the grocery list bucketed by category. `budget` is a
    query param to mirror the frontend's `getGroceryList(profile)`
    signature — the backend doesn't currently enforce the budget
    cap, but cut (b) will (per the blueprint's grocery module)."""
    items = state.list_grocery()
    return GroceryList(budget=budget, groups=_bucket_grocery_by_category(items))


@router.post(
    "/items",
    response_model=GroceryItem,
    status_code=status.HTTP_201_CREATED,
)
def add_grocery_item(
    body: AddGroceryRequest,
    state: State = Depends(get_state),
) -> GroceryItem:
    """Add a new custom item. Lands in the `Other` bucket until the
    seeded-category map learns about its id (which never happens for
    custom items in cut a)."""
    return state.add_grocery(body.name, body.price)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_grocery_item(
    item_id: str,
    state: State = Depends(get_state),
) -> None:
    try:
        state.remove_grocery(item_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put(
    "/items/{item_id}/price",
    status_code=status.HTTP_204_NO_CONTENT,
)
def update_grocery_price(
    item_id: str,
    body: UpdatePriceRequest,
    state: State = Depends(get_state),
) -> None:
    try:
        state.update_grocery_price(item_id, body.price)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/items/{item_id}/toggle", response_model=GroceryItem)
def toggle_grocery_item(
    item_id: str,
    state: State = Depends(get_state),
) -> GroceryItem:
    """Flip the `checked` flag for an item. The frontend mirrors this
    one-for-one."""
    try:
        return state.toggle_grocery(item_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_grocery_list(state: State = Depends(get_state)) -> None:
    """Empty the grocery list. The seeded items are wiped too — the
    frontend's `clearGroceryList` is also destructive on the mock."""
    state.clear_grocery()
