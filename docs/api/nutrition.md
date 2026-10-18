# Nutrition API

Three endpoints: macro targets, nutrition resolution with the cascade,
and personalized flag evaluation.

## `GET /api/nutrition/targets`

Per-meal macro/micro ceilings. Used by `NutrientsScreen` to render
the verdict chips and progress bars.

### Request

No parameters.

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kcal": 700,
  "protein": 35,
  "carbs": 80,
  "fat": 25,
  "fiber": 10,
  "sodium": 800,
  "sugar": 25
}
```

**Schema:** `MacroTargets` (see [schemas.md](../schemas.md#meals--aggregates)).

The values are derived from the user's profile and the
`DAILY_KCAL_TARGET_DEFAULT` (2000). The default per-meal ceiling
is 35% of the daily target.

### Example

```bash
curl http://localhost:8000/api/nutrition/targets
```

---

## `GET /api/nutrition/resolve`

Resolve nutrition for a list of detected items. Runs the
**OFF → USDA → Fruityvice cascade** and returns the resolved items
plus a SHAP-style per-nutrient contribution list.

### Request

Query parameters:
- `items` (JSON-encoded list of `DetectedItem`)

```bash
curl "http://localhost:8000/api/nutrition/resolve?items=$(echo '[{"name":"chicken","confidence":80,"grams":180}]' | python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.stdin.read()))')"
```

Or with a JSON body (preferred when the request is large):

```http
POST /api/nutrition/resolve HTTP/1.1
Content-Type: application/json

{
  "items": [
    {"name": "chicken", "confidence": 80, "grams": 180}
  ]
}
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "resolved": [
    {
      "name": "chicken",
      "confidence": 80,
      "grams": 180,
      "note": null,
      "bbox": null,
      "nutrition": {
        "protein": 31.0,
        "carbs": 0.0,
        "fat": 3.6,
        "kcal": 165,
        "fiber": 0.0,
        "sodium": 74.0,
        "sugar": 0.0,
        "glycemic": 0.0
      },
      "descriptor": {
        "protein": 31.0, "carbs": 0.0, "fat": 3.6, "kcal": 165,
        "fiber": 0.0, "sodium": 74.0, "sugar": 0.0, "glycemic": 0.0,
        "emoji": "🍗",
        "category": "protein",
        "alternatives": ["turkey", "duck"],
        "pairings": ["rice", "salad"]
      },
      "source": "open-food-facts",
      "partial": false
    }
  ],
  "contributions": [
    {
      "nutrient": "sodium",
      "itemName": "chicken",
      "amount": 133.2,
      "share": 0.18,
      "flagged": false,
      "reason": null,
      "tone": null
    }
  ]
}
```

**Schema:** `ResolveNutritionResult` (see [schemas.md](../schemas.md#vision-pipeline-outputs)).

### Cascade order

1. **Open Food Facts** — first stop, broadest coverage
2. **USDA FDC** — second stop, US-government curated
3. **Fruityvice** — last stop, fruit-only

The cascade stops at the first DB that returns a confident match
(non-zero kcal). Each client returns `None` on miss / error so the
next one is tried.

If no DB matches, the item is returned with `nutrition: null`,
`descriptor: null`, `source: 'estimated'`, `partial: true`.

### Contributions

`contributions` is one entry per (item, nutrient) pair. Each
contribution includes:
- `nutrient` — `'sodium' | 'sugar' | 'fiber' | 'protein' | 'carbs' | 'fat' | 'kcal'`
- `itemName`
- `amount` — absolute amount in the same unit as `NutritionFacts`
- `share` — share of total in this nutrient (0–1)
- `flagged` — `true` if this contribution crosses a flag threshold
- `reason` — human-readable text (e.g. "X adds 850mg sodium — that's
  110% of your daily cap in one item")
- `tone` — `'good' | 'warn'` for the verdict chip

### Example

```bash
curl -X POST http://localhost:8000/api/nutrition/resolve \
  -H "Content-Type: application/json" \
  -d '{"items": [{"name": "chicken", "confidence": 80, "grams": 180}]}'
```

---

## `GET /api/nutrition/personalize`

Evaluate flag rules for a resolved item list against a user profile.
This is also computed automatically by `/resolve`; the standalone
endpoint exists for the frontend to re-evaluate when the profile
changes (e.g. toggling a goal on the Profile screen).

### Request

Query parameters:
- `items` (JSON-encoded list of `ResolvedItem`)
- `profile_id` (optional; defaults to the current session profile)

Or with a JSON body:

```http
POST /api/nutrition/personalize HTTP/1.1
Content-Type: application/json

{
  "items": [<ResolvedItem>, ...],
  "profile": {<UserProfile>}
}
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "contributions": [<NutrientContribution>, ...],
  "focusedNutrients": [
    {"nutrient": "sodium", "threshold": 800},
    {"nutrient": "fiber",  "threshold": 10}
  ]
}
```

**Schema:** `ResolveNutritionResult` (same as `/resolve`).

### Focused nutrients

Diabetic profiles focus on `sugar` + `fiber`. Everyone else focuses
on `sodium` + `fiber`. The "Why these flags?" strip on
`NutrientsScreen` is built from `focusedNutrients` + flagged
`contributions`.

### Example

```bash
curl -X POST http://localhost:8000/api/nutrition/personalize \
  -H "Content-Type: application/json" \
  -d @personalize-payload.json
```

---

## See also

- [services.md](../backend/services.md) — `off_client`, `usda_client`,
  `fruityvice_client`, `personalize`
- [schemas.md](../schemas.md) — `MacroTargets`, `ResolveNutritionResult`,
  `NutrientContribution`