# Profile API

Management endpoints for the user's personal anthropometrics, clinical health goals, dietary preferences, allergens, daily grocery budget, and target calorie metrics.

---

## `GET /api/profile`

Fetches the profile for the currently authenticated user.

### Request

```http
GET /api/profile HTTP/1.1
Authorization: Bearer <jwt-token>
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "name": "Bikash Talukder",
  "age": 28,
  "sex": "male",
  "heightCm": 175.0,
  "weightKg": 72.0,
  "heightUnit": "cm",
  "weightUnit": "kg",
  "activityLevel": "moderate",
  "goal": "improve_health",
  "targetRateKgPerWeek": null,
  "dietType": "standard",
  "medicalConditions": [],
  "mealsPerDay": 3,
  "consentAnonymizedData": true,
  "language": "en",
  "goals": {
    "diabetic": false,
    "protein": true,
    "budget": true,
    "mediter": false
  },
  "preferences": [],
  "allergens": [],
  "budget": 500.0,
  "serving": 1,
  "dailyKcalTarget": 2200.0
}
```

**Schema:** `UserProfile` (see [schemas.md](../schemas.md#profile--clinical-personalization)).

---

## `PUT /api/profile`

Updates the profile for the authenticated user. New calorie and macro ceilings will recalculate dynamically across the Home and Nutrients screens.

### Request

```http
PUT /api/profile HTTP/1.1
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "Bikash Talukder",
  "age": 28,
  "sex": "male",
  "heightCm": 175.0,
  "weightKg": 72.0,
  "goals": {
    "diabetic": true,
    "protein": false,
    "budget": true,
    "mediter": false
  },
  "budget": 600.0,
  "dailyKcalTarget": 2100.0
}
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "name": "Bikash Talukder",
  ...
}
```

---

## See Also

- [auth.md](./auth.md) — Authentication and token issuance
- [admin.md](./admin.md) — Admin inspection of user profiles
- [schemas.md](../schemas.md) — `UserProfile` definition
