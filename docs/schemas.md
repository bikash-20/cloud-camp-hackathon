# Schema Lockstep Specification

`src/types/schemas.ts` and `app/models/schemas.py` are the unified wire-format contract for NutriVision AI.

---

## 1. The Lockstep Rule

> **Any modification to a wire-format contract in `src/types/schemas.ts` requires a corresponding update to `app/models/schemas.py`, and vice versa.**

This requirement is strictly enforced in CI by `app/tests/test_schema_drift.py`. The drift test:
1. Parses the TypeScript AST via `scripts/dump-schemas.mjs`.
2. Inspects Python Pydantic v2 model fields and Literal aliases.
3. Normalizes field naming conventions (`camelCase` $\leftrightarrow$ `snake_case`) and type equivalents (`number` $\leftrightarrow$ `float/int`, arrays, optionality).
4. Verifies field-by-field and value-by-value equality across both definitions.

---

## 2. The `MUST_MATCH` Contract

The following 46 schemas must match identically on both sides:

### Core Nutrition Primitives
- `NutritionFacts`: Per-100g nutritional profile (calories, protein, carbs, fat, fiber, sodium, sugar, glycemic index).
- `FoodDescriptor`: Categorization, unit weights, localized translations, and nutritional facts.
- `FoodCategory`: `'protein' | 'produce' | 'grains' | 'other'`.

### Vision Pipeline Outputs
- `DetectedItem`: Food name, bounding box coordinates, confidence score, estimated portion grams, and optional brand.
- `ResolvedItem`: Nutritional composition combined with portion scaling and flag triggers.
- `PipelineTrace`: Stage identification, timing, and provider status (`success`, `fallback`, `skipped`, `error`).
- `AnalyzeResult`: Detected items array and complete pipeline execution trace.
- `NutrientContribution`: SHAP-style breakdown of individual ingredients to meal macros.
- `ResolveNutritionResult`: Resolved items and explainability contributions.
- `InputMode`: `'photo' | 'recipe' | 'menu'`.
- `RecipeSuggestion`: Recommended regional high-protein meals generated from raw ingredients.
- `MenuItemAnalysis`: Restaurant menu OCR analysis flagging hidden oils, sodium, and auto-immune triggers.

### AI Coach & Multi-Agent Architecture
- `CoachRole`: `'user' | 'assistant' | 'system'`.
- `CoachAgentType`: `'scientist' | 'behavioral'`.
- `CoachMessage`: Chat conversation bubble structure with agent metadata.
- `CoachChatRequest`: Payload containing query, persona, active health goals, meal history, active grocery items, and audio inclusion flag.
- `CoachChatResponse`: Structured response with BIRDEM/WHO citations, habit loops, action chips, concise spoken summary (`voice_summary`), and optional base64 MP3 audio.
- `CoachTTSRequest`: On-demand text-to-speech request with text, language code, and voice preset.
- `CoachTTSResponse`: TTS response with optional base64 audio, audio MIME type, and browser fallback flag.

### Profile & Clinical Personalization
- `HealthGoals`: Boolean clinical indicators (`diabetic`, `protein`, `budget`, `mediter`).
- `DietaryPreference`: `'Vegetarian' | 'Vegan' | 'Pescatarian' | 'Gluten-free' | 'Dairy-free' | 'Halal' | 'Kosher'`.
- `Allergen`: 8 major allergens (`Peanuts`, `Tree nuts`, `Shellfish`, `Soy`, `Eggs`, `Dairy`, `Gluten`, `Sesame`).
- `Sex`: `'male' | 'female' | 'other'`.
- `ActivityLevel`: `'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'`.
- `GoalType`: `'lose_weight' | 'maintain' | 'gain_muscle' | 'improve_health'`.
- `DietType`: Regional and clinical dietary classifications.
- `MedicalCondition`: Pre-existing conditions (`diabetes_type1`, `diabetes_type2`, `hypertension`, `ckd`, `none`).
- `HeightUnit` / `WeightUnit`: Measurement system preferences (`'cm' | 'in'`, `'kg' | 'lbs'`).
- `UserProfile`: Consolidated clinical user profile, anthropometrics, preferences, and daily calorie target.

### Grocery & Market Supply
- `GroceryItem`: ID, name, BDT price, checked status, and category.
- `GroceryGroup`: Categorized grocery section.
- `GroceryList`: Total estimated expenditure, weekly cap, and grouped items.

### Meals & Aggregates
- `MealTotals`: Per-meal snapshot totals (calories, macros, micronutrients).
- `MealEntry`: Durable meal record with timestamp, label, detected items, totals, photo reference, and review status.
- `UserStats`: Aggregated user statistics (total meals, active days, average daily calories, streak days).
- `TodaySummary`: Caloric progress and macro sums for the home dashboard.
- `MacroTargets`: Personalized daily and per-meal targets calculated from clinical equations.

### Auth & Admin Telemetry
- `Role`: `'user' | 'admin'`.
- `AuthSession`: Client authentication state (user profile, token, expiration).
- `GoogleAuthRequest`: Google Identity Services ID token credential wrapper.
- `GoogleAuthResponse`: Authenticated user, session JWT, and role.
- `AdminMetrics`: Live platform telemetry (registered users, active 7d, new today, meals today/week, volume, flagged ratios).
- `DailyMealVolume`: Single-day meal count object with ISO date and day label for sparkline rendering.
- `AdminUserSummary`: Directory record for multi-user list view with streak and meal counts.
- `AdminUserDetail`: Extended user profile with full meal history and statistics for inspection modal.
- `PopularFoodItem`: Food name, frequency count, percentage share, and average detection confidence.
- `ReviewQueueAction`: `'approve' | 'correct' | 'dismiss'`.
- `ReviewQueueItem`: Flagged low-confidence meal record with photo and food items.
- `ReviewQueueUpdateRequest`: Admin action payload with optional label correction.

---

## 3. Permitted Unilateral Divergences

Certain types are specific to a single environment and are exempted from the bidirectional drift requirement:

### Frontend-Only (`allowed_ts_only`)
- `TabId`: Client navigation tab enum (`'capture' | 'results' | 'nutrients' | 'profile' | 'grocery' | 'coach'`).
- `TabDescriptor`: UI metadata for navigation dock items.
- `ConfidenceBucket`: UI styling badge tier (`'high' | 'medium' | 'low'`).

### Backend-Only (`allowed_py_only`)
- `BBox`: Coordinates tuple `tuple[float, float, float, float]`.
- `DensityEntry`: Food portion volume-density coefficient.
- `PipelineStage` / `PipelineStatus`: Python literals for internal pipeline telemetry.
- `VisionDetectionResult`: Raw provider response intermediate.
