# Grocery API

CRUD for the user's grocery list, plus the "generate from meals"
endpoint that powers the `GroceryScreen` quick action.

## `GET /api/grocery`

Fetch the current grocery list.

### Request

No parameters.

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "budget": 350,
  "groups": [
    {
      "category": "Grains",
      "items": [
        {"id": "g1", "name": "Basmati Rice", "price": 120, "checked": false}
      ]
    },
    {
      "category": "Produce",
      "items": [
        {"id": "g2", "name": "Onion", "price": 40, "checked": true}
      ]
    },
    {
      "category": "Protein",
      "items": [
        {"id": "g3", "name": "Chicken Breast", "price": 250, "checked": false}
      ]
    }
  ]
}
```

**Schema:** `GroceryList` (see [schemas.md](../schemas.md#grocery)).

### Example

```bash
curl http://localhost:8000/api/grocery
```

---

## `POST /api/grocery/items`

Add a new item to the grocery list.

### Request

```http
POST /api/grocery/items HTTP/1.1
Content-Type: application/json

{
  "name": "Tomato",
  "price": 30,
  "category": "Produce"
}
```

`category` is required so the item is grouped correctly. The server
generates the `id`.

### Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "g4",
  "name": "Tomato",
  "price": 30,
  "checked": false
}
```

**Schema:** `GroceryItem`.

### Example

```bash
curl -X POST http://localhost:8000/api/grocery/items \
  -H "Content-Type: application/json" \
  -d '{"name": "Tomato", "price": 30, "category": "Produce"}'
```

---

## `POST /api/grocery/batch`

Atomically adds multiple items to the grocery list in a single HTTP transaction.

### Request

```http
POST /api/grocery/batch HTTP/1.1
Content-Type: application/json

[
  {
    "name": "Boiled Egg",
    "price": 15,
    "category": "Dairy & eggs"
  },
  {
    "name": "Tomato",
    "price": 40,
    "category": "Produce"
  }
]
```

### Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

[
  {
    "id": "g-new-1",
    "name": "Boiled Egg",
    "price": 15,
    "checked": false
  },
  {
    "id": "g-new-2",
    "name": "Tomato",
    "price": 40,
    "checked": false
  }
]
```

### Example

```bash
curl -X POST http://localhost:8000/api/grocery/batch \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '[{"name":"Boiled Egg","price":15,"category":"Dairy & eggs"},{"name":"Tomato","price":40,"category":"Produce"}]'
```

---

## `PUT /api/grocery/items/{id}`

Update an existing item (rename, change price, check/uncheck).

### Request

```http
PUT /api/grocery/items/g4 HTTP/1.1
Content-Type: application/json

{
  "name": "Cherry Tomato",
  "price": 35,
  "checked": true
}
```

All fields are optional; omitted fields keep their current value.

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "g4",
  "name": "Cherry Tomato",
  "price": 35,
  "checked": true
}
```

### Errors

| Status | Cause |
|---|---|
| `404 Not Found` | `id` doesn't exist |

### Example

```bash
curl -X PUT http://localhost:8000/api/grocery/items/g4 \
  -H "Content-Type: application/json" \
  -d '{"checked": true}'
```

---

## `DELETE /api/grocery/items/{id}`

Remove an item from the list.

### Request

No body. `id` is in the path.

### Response

```http
HTTP/1.1 204 No Content
```

### Example

```bash
curl -X DELETE http://localhost:8000/api/grocery/items/g4
```

---

## `POST /api/grocery/clear`

Clear all checked items from the list. Or clear all items
regardless of state — see the `?all=true` query parameter.

### Request

```http
POST /api/grocery/clear HTTP/1.1
```

Query parameters:
- `all=true` — clear every item, not just checked ones

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "removed": 3
}
```

### Example

```bash
# Clear only checked items
curl -X POST http://localhost:8000/api/grocery/clear

# Clear everything
curl -X POST "http://localhost:8000/api/grocery/clear?all=true"
```

---

## `POST /api/grocery/generate`

Auto-generate grocery items from the user's meal history. For each
meal in the recent history, look up the food's `pairings` in
`MOCK_NUTRITION_DB` and add any pairings not already in the list.

### Request

No body.

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "added": 4,
  "list": {<updated GroceryList>}
}
```

### Example

```bash
curl -X POST http://localhost:8000/api/grocery/generate
```

---

## See also

- [services.md](../backend/services.md) — `state.py` (grocery bucket)
- [schemas.md](../schemas.md) — `GroceryItem`, `GroceryGroup`, `GroceryList`