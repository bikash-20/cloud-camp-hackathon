# Meals API

CRUD for the user's meal history, plus the today's summary
endpoint that powers the Home progress bar.

## `GET /api/meals`

Fetch the user's meal history, newest first.

### Request

Query parameters:
- `limit` (optional) — max number of meals to return
- `since` (optional) — ISO timestamp; only meals after this time

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "id": "meal_1729…",
    "date": "2026-10-18T12:34:56.000Z",
    "label": "Chicken, Rice, Salad",
    "items": [<DetectedItem>, ...],
    "totals": {
      "kcal": 520,
      "protein": 38,
      "carbs": 65,
      "fat": 12,
      "fiber": 6,
      "sodium": 480,
      "sugar": 8
    },
    "photoUrl": "data:image/jpeg;base64,...",
    "activeGoals": {
      "diabetic": false,
      "protein": false,
      "budget": true,
      "mediter": false
    }
  }
]
```

**Schema:** `MealEntry[]` (see [schemas.md](../schemas.md#meals--aggregates)).

### Example

```bash
# All meals
curl http://localhost:8000/api/meals

# Last 5
curl "http://localhost:8000/api/meals?limit=5"

# Since a specific date
curl "http://localhost:8000/api/meals?since=2026-10-01T00:00:00Z"
```

---

## `POST /api/meals`

Save a new meal to the history.

### Request

```http
POST /api/meals HTTP/1.1
Content-Type: application/json

{
  "id": "meal_1729…",
  "date": "2026-10-18T12:34:56.000Z",
  "label": "Chicken, Rice, Salad",
  "items": [<DetectedItem>, ...],
  "totals": {<MealTotals>},
  "photoUrl": "data:image/jpeg;base64,...",
  "activeGoals": {<HealthGoals>}
}
```

`id`, `date`, and `activeGoals` are optional — the server fills in
sensible defaults. `items` and `totals` are required.

### Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "meal_1729…",
  "date": "2026-10-18T12:34:56.000Z",
  ...
}
```

**Schema:** `MealEntry`.

### Example

```bash
curl -X POST http://localhost:8000/api/meals \
  -H "Content-Type: application/json" \
  -d @meal.json
```

---

## `GET /api/meals/{id}`

Fetch a single meal by id.

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "meal_1729…",
  ...
}
```

### Errors

| Status | Cause |
|---|---|
| `404 Not Found` | `id` doesn't exist |

---

## `DELETE /api/meals/{id}`

Remove a meal from the history.

### Response

```http
HTTP/1.1 204 No Content
```

### Example

```bash
curl -X DELETE http://localhost:8000/api/meals/meal_1729…
```

---

## `GET /api/meals/today`

Today's logged-meals summary. Powers the Home progress bar on
`CaptureScreen`.

### Request

No parameters.

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "mealsLogged": 2,
  "totalKcal": 1240,
  "totalProtein": 78,
  "totalCarbs": 142,
  "totalFat": 32,
  "dailyKcalTarget": 2000
}
```

**Schema:** `TodaySummary` (see [schemas.md](../schemas.md#meals--aggregates)).

The "X of 2000 kcal today" bar is `totalKcal / dailyKcalTarget`.
`dailyKcalTarget` is resolved from the profile (with
`DAILY_KCAL_TARGET_DEFAULT` = 2000 fallback for older profiles).

### Example

```bash
curl http://localhost:8000/api/meals/today
```

---

## `GET /api/meals/stats`

Aggregated user stats. Powers the "Your stats" card on
`ProfileScreen`.

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "totalMeals": 47,
  "totalDaysActive": 14,
  "avgDailyKcal": 1875,
  "streakDays": 5
}
```

**Schema:** `UserStats`.

`streakDays` is the number of consecutive days with at least one
logged meal ending today.

### Example

```bash
curl http://localhost:8000/api/meals/stats
```

---

## See also

- [services.md](../backend/services.md) — `state.py` (meals bucket),
  `targets.py` (kcal target resolver)
- [schemas.md](../schemas.md) — `MealEntry`, `MealTotals`,
  `TodaySummary`, `UserStats`