# Schemas

The wire-format source of truth for the project. Both the frontend
(`src/types/schemas.ts`) and the backend (`app/models/schemas.py`)
mirror the same shapes, and a test enforces that they stay in sync.

## The rule

> **Any change to `src/types/schemas.ts` requires a matching change to
> `app/models/schemas.py`, and vice versa.** A change to one without
> the other is a breaking integration bug.

This is enforced by `app/tests/test_schema_drift.py`, which runs on
every push and PR (see [development.md](./development.md#ci)).

## The MUST_MATCH contract

The drift test compares 22 named types. Every name in this set must
appear on both sides with matching fields:

### Core nutrition primitives
- `NutritionFacts` — per-100g macros + micros
- `FoodDescriptor` — display metadata + per-100g nutrition
- `FoodCategory` — `'protein' | 'produce' | 'grains' | 'other'`

### Vision pipeline outputs
- `DetectedItem` — one food before nutrition resolution
- `ResolvedItem` — after nutrition DB cascade
- `PipelineTrace` — per-stage status for the toast
- `AnalyzeResult` — `detected` + `pipeline`
- `NutrientContribution` — SHAP-style explainability
- `ResolveNutritionResult` — `resolved` + `contributions`

### Profile + personalization
- `HealthGoals` — 4 boolean goal flags
- `DietaryPreference` — 7 values
- `Allergen` — 8 values
- `UserProfile` — name, goals, preferences, allergens, budget, serving, dailyKcalTarget

### Grocery
- `GroceryItem` — id, name, price, checked
- `GroceryGroup` — category + items
- `GroceryList` — budget + groups

### Meals + aggregates
- `MealTotals` — per-meal snapshot
- `MealEntry` — id, date, label, items, totals, photoUrl, activeGoals
- `UserStats` — totals for the profile screen
- `TodaySummary` — the Home progress bar
- `MacroTargets` — per-meal ceilings

## Allowed divergences

Some types legitimately exist on only one side. The drift test
**expects** these and they don't trigger failures.

### TS-only (frontend concerns)
- `TabId` — `'capture' | 'results' | 'nutrients' | 'profile' | 'grocery'`
- `TabDescriptor` — id, label, icon
- `Role` — `'user' | 'admin'`
- `AuthSession` — email, role, loginAt
- `DemoUser` — admin directory entry
- `ConfidenceBucket` — `'high' | 'medium' | 'low'` (UI badge styling)

### Python-only (backend concerns)
- `BBox` — `tuple[float, float, float, float]` alias
- `DensityEntry` — portion density helper
- `field_validator` — Pydantic helper
- `PipelineStage` — `Literal[...]` alias used in Python
- `PipelineStatus` — `Literal[...]` alias used in Python

If you add a new type that should be frontend-only, add it to
`allowed_ts_only` in `app/tests/test_schema_drift.py`. Same for
`allowed_py_only` for backend-only types.

## How the drift test works

1. **TS dump** — `scripts/dump-schemas.mjs` walks the AST of
   `src/types/schemas.ts` using the `typescript` compiler API and
   emits `{InterfaceName: {fieldName: tsTypeString}}` JSON.
   - String-literal unions (`type X = 'a' | 'b'`) become
     `{__literal: ['a', 'b']}`.
   - Interfaces that `extends` a parent flatten the parent's fields.
   - Inline literal unions in field types that match a top-level
     alias are re-written to the alias name.
2. **Pydantic dump** — `_dump_python_schemas()` walks
   `app.models.schemas` and emits the same shape.
   - `Literal[...]` aliases are emitted as their values.
   - If a Literal matches a known alias in the module, the alias
     name is emitted instead of the inline `__literal` block.
   - Pydantic model fields are emitted by their annotation kind
     (`number`, `string`, `boolean`, `string[]`, `number | null`,
     `[number, number, number, number]`, etc.).
3. **Normalization** — fields are compared after:
   - camelCase ↔ snake_case (`dailyKcalTarget` ↔ `daily_kcal_target`)
   - Optional/nullable collapse (`X | null` ↔ `X | None` ↔ `X`)
   - `list[X]` ↔ `X[]` surface form
4. **Per-type comparison** — for each type in `MUST_MATCH`:
   - The set of fields must match.
   - The kind of each shared field must be compatible.

## How strict is the comparison?

The kind comparison is **intentionally loose** about cosmetic
cross-language differences:

| TS kind | Python kind | Match? |
|---|---|---|
| `string` | `str` | ✅ |
| `number` | `float` | ✅ |
| `number` | `int` | ✅ |
| `boolean` | `bool` | ✅ |
| `string[]` | `list[str]` | ✅ |
| `X[]` | `{"__literal": [...]}` | ✅ (if values match) |
| `X` | `app.models.schemas.X` | ✅ |
| `number \| null` | `number` | ✅ (optional collapse) |
| `string[]` | `string` | ❌ (wrong element type) |
| `X` | `Y` (different type) | ❌ |

The test is strict about:
- Wrong list element types (`string[]` ≠ `number[]`)
- Scalar-vs-object mismatches (`string` ≠ `NutritionFacts`)
- Tuple vs list collapses (`[number, number, number, number]` ≠ `number[]`)

## How to add a new type to both sides

1. **Add the type to `src/types/schemas.ts`.** Match the existing
   conventions: PascalCase, snake_case fields, JSDoc comments on
   every field.
2. **Add the matching Pydantic model to `app/models/schemas.py`.**
   Field annotations should use the project's existing patterns:
   `float` for decimals, `int` for counts, `str` for names,
   `list[X]` for collections, `X | None` for optionals.
3. **Add the type name to `MUST_MATCH`** in
   `app/tests/test_schema_drift.py`. If the type is frontend-only or
   backend-only, add it to `allowed_ts_only` or `allowed_py_only`
   instead.
4. **Run the drift test:**
   ```bash
   cd app
   python -m pytest tests/test_schema_drift.py -v
   ```
5. **If the test reports a kind mismatch** (e.g. `TS='string' vs
   Python='Optional[str]'`), check that:
   - The Pydantic field uses `str` not `Optional[str]` if the TS side
     marks the field as required.
   - The TS field uses `?:` to mark optional, otherwise the Python
     side's `T | None` will be tolerated as a `T` (collapse rule).
6. **If the type uses string-literal values**, make sure both sides
   use the same strings (case-sensitive). The test compares sorted
   value lists.

## How to add a new Literal alias

```ts
// src/types/schemas.ts
export type MyNewEnum = 'a' | 'b' | 'c';
```

```python
# app/models/schemas.py
MyNewEnum = Literal["a", "b", "c"]
```

Both files can use the alias by name; the drift test handles the
diff between inline literals and alias references.

If the alias is **frontend-only**, define it in `schemas.ts` and add
the name to `allowed_ts_only`. The drift test will skip it.

## Drift test files

- `app/tests/test_schema_drift.py` — the test itself
- `scripts/dump-schemas.mjs` — the TS AST walker
- `MUST_MATCH` (line 199) — the contract list
- `allowed_ts_only` (line 261) — TS-only divergences
- `allowed_py_only` (line 269) — Python-only divergences
- `_annotation_to_kind()` (line 116) — the Python emitter
- `_kinds_compatible()` (line 346) — the loose kind comparator

## Common drift test failures

### "fields only in TS — [...]"
You added a field to `schemas.ts` but not to `schemas.py`. Either
add the matching field on the Python side, or — if the field is
frontend-only — add it to `allowed_ts_only` (no, that's only for
whole types, not fields). For fields, you must add them to both sides
or the test will fail.

### "fields only in Python — [...]"
Same as above, in the other direction.

### "field-type mismatches: 'foo': TS='X' vs Python='Y'"
The field exists on both sides but the types differ. Check:
- `X` vs `Y` are not in the loose-match table (e.g. `string` vs `number`).
- A Literal alias on one side and a bare `str` on the other (decide
  which is right and align).
- Optional marker mismatch that didn't collapse cleanly (rare —
  usually the `T | None` ↔ `T` collapse handles it).

### "TS schema has types not declared in MUST_MATCH"
You added a new type to `schemas.ts` but didn't add it to
`MUST_MATCH` or `allowed_ts_only`. Add the name to one of them.