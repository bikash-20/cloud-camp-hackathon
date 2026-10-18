# Profile API

The user's profile (goals, preferences, allergens, budget, serving
size, daily kcal target). Plus the admin directory endpoints used
by the admin dashboard.

## `GET /api/profile`

Fetch the current user's profile.

### Request

No parameters. The user is identified by the auth session
(`mock-auth` for the demo).

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "name": "Demo User",
  "goals": {
    "diabetic": false,
    "protein": false,
    "budget": true,
    "mediter": false
  },
  "preferences": ["Vegetarian"],
  "allergens": ["Peanuts"],
  "budget": 350,
  "serving": 2,
  "dailyKcalTarget": 2000
}
```

**Schema:** `UserProfile` (see [schemas.md](../schemas.md#profile--personalization)).

`dailyKcalTarget` is optional; older profiles fall back to
`DAILY_KCAL_TARGET_DEFAULT` (2000).

### Example

```bash
curl http://localhost:8000/api/profile
```

---

## `PUT /api/profile`

Replace the current user's profile.

### Request

```http
PUT /api/profile HTTP/1.1
Content-Type: application/json

{
  "name": "Demo User",
  "goals": {
    "diabetic": true,
    "protein": false,
    "budget": false,
    "mediter": false
  },
  "preferences": ["Vegetarian", "Gluten-free"],
  "allergens": ["Peanuts", "Tree nuts"],
  "budget": 350,
  "serving": 2,
  "dailyKcalTarget": 1800
}
```

**Schema:** `UserProfile`.

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "name": "Demo User",
  "goals": {...},
  ...
}
```

The returned object is the new state (after applying defaults for
any missing fields).

### Errors

| Status | Cause |
|---|---|
| `422 Unprocessable Entity` | Body fails Pydantic validation |
| `404 Not Found` | Profile doesn't exist (shouldn't happen for the current user) |

### Example

```bash
curl -X PUT http://localhost:8000/api/profile \
  -H "Content-Type: application/json" \
  -d @new-profile.json
```

---

## `GET /api/profile/demo-users` (admin)

List the synthetic accounts shown in the admin dashboard. The
**real signed-in user is included** as one of these.

### Request

Requires admin session.

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "email": "user@nutrivision.ai",
    "displayName": "Demo User",
    "joinedDaysAgo": 14,
    "meals": [<MealEntry>, ...]
  },
  {
    "email": "alice@example.com",
    "displayName": "Alice",
    "joinedDaysAgo": 30,
    "meals": [<MealEntry>, ...]
  }
]
```

**Schema:** `DemoUser[]` (frontend-only type; not in the drift test's
`MUST_MATCH`).

The admin dashboard doesn't see passwords — only the public profile
+ a generated meal history.

---

## See also

- [services.md](../backend/services.md) — `state.py` (profile bucket)
- [schemas.md](../schemas.md) — `UserProfile`, `DemoUser`