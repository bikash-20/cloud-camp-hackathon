/**
 * NutriVision AI — TypeScript schema contracts
 *
 * Mirrors the planned `app/models/schemas.py` (FastAPI/Pydantic) on the
 * backend. This file is the **source of truth** for the frontend.
 *
 * Per the blueprint's Section 8 directive, any backend schema change
 * requires this file to update in lockstep to avoid integration drift.
 *
 * Naming convention:
 *   - PascalCase types
 *   - snake_case fields (matches what a Python backend would emit)
 *   - All numeric nutrient values are per-100g servings unless suffixed
 */

// ─────────────────────────────────────────────────────────────────────────
//  Core nutrition primitives
// ─────────────────────────────────────────────────────────────────────────

/** Per-100g macro/micro nutrient facts for a single food item. */
export interface NutritionFacts {
  /** grams of protein */
  protein: number;
  /** grams of carbohydrates */
  carbs: number;
  /** grams of fat */
  fat: number;
  /** kilocalories */
  kcal: number;
  /** grams of fiber */
  fiber: number;
  /** milligrams of sodium */
  sodium: number;
  /** grams of sugar */
  sugar: number;
  /** glycemic share, 0–1 (used by personalize filter) */
  glycemic: number;
}

/** Food category used to pick tile gradients and grocery group routing. */
export type FoodCategory = 'protein' | 'produce' | 'grains' | 'other';

/** A single food with display metadata + per-100g nutrition. */
export interface FoodDescriptor extends NutritionFacts {
  emoji: string;
  category: FoodCategory;
  /** Alternative names the vision model may also emit. */
  alternatives: string[];
  /** Pairings the grocery list may suggest. */
  pairings: string[];
}

// ─────────────────────────────────────────────────────────────────────────
//  Vision pipeline outputs
// ─────────────────────────────────────────────────────────────────────────

/**
 * One food item detected by the dual vision pipeline (Gemini + HF validator)
 * before nutrition is resolved.
 */
export interface DetectedItem {
  /** Canonical food name; should match a key in NUTRITION_DB */
  name: string;
  /** Confidence 0–100; <70 is flagged low-confidence */
  confidence: number;
  /** Estimated portion size in grams */
  grams: number;
  /** Optional user-facing note (e.g. "Low confidence — tap to confirm") */
  note?: string | null;
  /** Optional bounding box from the vision model [x, y, w, h] in 0–1 space */
  bbox?: [number, number, number, number];
}

/**
 * A DetectedItem after passing through the nutrition DB cascade (OFF →
 * USDA → Fruityvice). Used by personalize to re-rank flagged items.
 */
export interface ResolvedItem extends DetectedItem {
  /** Resolved per-100g facts; null if no DB had a confident match */
  nutrition: NutritionFacts | null;
  /** Display metadata resolved along with nutrition */
  descriptor: FoodDescriptor | null;
  /** Which DB resolved this item (for explainability) */
  source: 'open-food-facts' | 'usda' | 'fruityvice' | 'cache' | 'estimated';
  /** True if the resolver only matched an "estimated" entry */
  partial?: boolean;
}

/**
 * Per-nutrient, per-item contribution. Powers the SHAP-style explainability
 * panel on NutrientsScreen.
 */
export interface NutrientContribution {
  /** Which nutrient is being explained */
  nutrient: 'sodium' | 'sugar' | 'fiber' | 'protein' | 'carbs' | 'fat' | 'kcal';
  /** Food item contributing */
  itemName: string;
  /** Absolute amount in the same unit as NutritionFacts */
  amount: number;
  /** Share of total in this nutrient (0–1) */
  share: number;
  /** True if this contribution crosses a flag threshold for the user */
  flagged: boolean;
  /** Human-readable reason this was flagged (item-specific, used by verdict chips) */
  reason?: string;
  /** Visual tone for the verdict chip — 'warn' for over-target, 'good' for under-target supportive */
  tone?: 'good' | 'warn';
}

/**
 * A pipeline trace entry surfaced in a tiny toast during analysis. Proves
 * the multi-stage architecture is real, not just a stub.
 */
export interface PipelineTrace {
  stage: 'capture' | 'cache-check' | 'vision-id' | 'hf-validate' | 'reconcile' | 'nutrition' | 'portion' | 'personalize' | 'explain';
  status: 'pending' | 'running' | 'done' | 'cache-hit' | 'fallback';
  startedAt: number;
  finishedAt?: number;
  label: string;
}

export interface AnalyzeResult {
  detected: DetectedItem[];
  pipeline: PipelineTrace[];
}

export interface ResolveNutritionResult {
  resolved: ResolvedItem[];
  contributions: NutrientContribution[];
}

// ─────────────────────────────────────────────────────────────────────────
//  User profile / personalization
// ─────────────────────────────────────────────────────────────────────────

/** Coarse metabolic goal the user can toggle. */
export interface HealthGoals {
  diabetic: boolean;
  protein: boolean;
  budget: boolean;
  mediter: boolean;
}

/** Dietary preferences (vegetarian, vegan, etc.). */
export type DietaryPreference =
  | 'Vegetarian'
  | 'Vegan'
  | 'Pescatarian'
  | 'Gluten-free'
  | 'Dairy-free'
  | 'Halal'
  | 'Kosher';

/** Common allergens tracked in the profile. */
export type Allergen =
  | 'Peanuts'
  | 'Tree nuts'
  | 'Shell shellfish'
  | 'Soy'
  | 'Eggs'
  | 'Dairy'
  | 'Gluten'
  | 'Sesame';

export interface UserProfile {
  name: string;
  goals: HealthGoals;
  preferences: DietaryPreference[];
  allergens: Allergen[];
  /** Daily grocery budget ceiling, in local currency (BDT).
   *  The Grocery screen applies a 7× multiplier to get the weekly cap. */
  budget: number;
  /** Number of people the meal serves */
  serving: number;
}

// ─────────────────────────────────────────────────────────────────────────
//  Grocery list
// ─────────────────────────────────────────────────────────────────────────

export interface GroceryItem {
  id: string;
  name: string;
  /** Per-unit price in BDT */
  price: number;
  checked: boolean;
}

export interface GroceryGroup {
  category: string;
  items: GroceryItem[];
}

export interface GroceryList {
  budget: number;
  groups: GroceryGroup[];
}

// ─────────────────────────────────────────────────────────────────────────
//  Tabs (client-side)
// ─────────────────────────────────────────────────────────────────────────

export type TabId = 'capture' | 'results' | 'nutrients' | 'profile' | 'grocery';

export interface TabDescriptor {
  id: TabId;
  label: string;
  icon: string;
}

// ─────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────

/** Rough confidence bucket used for badge styling on ResultsScreen. */
export type ConfidenceBucket = 'high' | 'medium' | 'low';

export function bucketizeConfidence(c: number): ConfidenceBucket {
  if (c >= 80) return 'high';
  if (c >= 60) return 'medium';
  return 'low';
}
