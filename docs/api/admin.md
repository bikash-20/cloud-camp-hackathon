# Admin Intelligence API

Administrative observability, multi-user management, food frequency telemetry, and low-confidence meal audit endpoints.

> **Security Note:** All endpoints in `/api/admin/*` require an active session JWT from a user whose verified email is listed in `ADMIN_EMAILS`. Requests from non-admin accounts return `403 Forbidden`.

---

## `GET /api/admin/metrics`

Returns real-time platform metrics aggregated directly from PostgreSQL.

### Request
```http
GET /api/admin/metrics HTTP/1.1
Authorization: Bearer <admin-jwt>
```

### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "totalRegisteredUsers": 4,
  "newUsersToday": 1,
  "activeUsers7d": 3,
  "mealsToday": 8,
  "mealsThisWeek": 34,
  "avgMealsPerUserWeek": 8.5,
  "flaggedMealsCount": 2,
  "totalMeals": 42,
  "flaggedPercentage": 4.76,
  "volume7d": [
    { "date": "2026-10-25", "dayLabel": "Sun", "count": 4 },
    { "date": "2026-10-26", "dayLabel": "Mon", "count": 6 },
    { "date": "2026-10-27", "dayLabel": "Tue", "count": 5 },
    { "date": "2026-10-28", "dayLabel": "Wed", "count": 3 },
    { "date": "2026-10-29", "dayLabel": "Thu", "count": 4 },
    { "date": "2026-10-30", "dayLabel": "Fri", "count": 4 },
    { "date": "2026-10-31", "dayLabel": "Sat", "count": 8 }
  ],
  "lastUpdated": "2026-10-31T04:15:00Z"
}
```

---

## `GET /api/admin/users`

Lists all registered users with sorting, search, and pagination.

### Query Parameters
- `q`: Search string matching email or name (e.g. `?q=bikash`).
- `sortBy`: Field to sort by (`joinedDate`, `lastActive`, `mealsLogged`, `streak`). Default: `lastActive`.
- `order`: `asc` or `desc`. Default: `desc`.
- `page`: Page index (default: `1`).
- `limit`: Number of users per page (default: `20`).

### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "email": "bikashtalukder040@gmail.com",
    "name": "Bikash Talukder",
    "avatarUrl": "https://lh3.googleusercontent.com/a/...",
    "role": "admin",
    "joinedDate": "2026-10-30T18:00:00Z",
    "lastActive": "2026-10-31T04:12:00Z",
    "mealsLogged": 14,
    "streakDays": 2
  }
]
```

---

## `GET /api/admin/users/{email}`

Returns comprehensive profile information, statistics, and recent meals for a specific user.

### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "summary": {
    "email": "user@gmail.com",
    "name": "Jane Doe",
    "avatarUrl": "...",
    "role": "user",
    "joinedDate": "2026-10-29T10:00:00Z",
    "lastActive": "2026-10-31T02:00:00Z",
    "mealsLogged": 8,
    "streakDays": 3
  },
  "profile": { ...UserProfile... },
  "recentMeals": [ ...MealEntry... ]
}
```

---

## `GET /api/admin/popular-foods`

Computes ranked food consumption frequency across all users with date-range filtering.

### Query Parameters
- `range`: Time period filter: `'today'`, `'7d'`, `'30d'`, or `'all'`. Default: `'7d'`.

### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "foodName": "Khichuri with egg",
    "count": 12,
    "sharePercentage": 24.5,
    "avgConfidence": 0.94
  },
  {
    "foodName": "Dal (lentils)",
    "count": 9,
    "sharePercentage": 18.4,
    "avgConfidence": 0.91
  }
]
```

---

## `GET /api/admin/review-queue`

Fetches meals flagged for review due to low vision confidence (<70%).

### Query Parameters
- `status`: Optional filter by review status: `'pending'`, `'approved'`, `'corrected'`, `'dismissed'`. Default: `'pending'`.

### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "mealId": "meal-8f2e9",
    "userEmail": "user@gmail.com",
    "date": "2026-10-31",
    "photoUrl": "data:image/jpeg;base64,...",
    "detectedLabel": "Unknown fried item",
    "confidence": 0.58,
    "reviewStatus": "pending",
    "createdAt": "2026-10-31T03:30:00Z"
  }
]
```

---

## `PATCH /api/admin/review-queue/{meal_id}`

Performs an administrative review action on a flagged meal.

### Request Body
```http
PATCH /api/admin/review-queue/meal-8f2e9 HTTP/1.1
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "action": "correct",
  "correctedLabel": "Shami Kabab"
}
```

**Actions:**
- `approve`: Keeps original label and marks meal as verified (`reviewStatus = "approved"`).
- `correct`: Updates the food item label to `correctedLabel` (`reviewStatus = "corrected"`).
- `dismiss`: Dismisses the item from the active audit queue (`reviewStatus = "dismissed"`).

### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "updated",
  "mealId": "meal-8f2e9",
  "reviewStatus": "corrected",
  "correctedLabel": "Shami Kabab"
}
```
