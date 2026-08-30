/**
 * Mock API client.
 *
 * Mirrors the planned FastAPI endpoints from `app/api/*` in the blueprint.
 * Every function returns a Promise with simulated network latency so that
 * wiring against the real backend later is a drop-in swap — the UI never
 * has to change, only this file.
 *
 * To replace with a real backend:
 *   1. Delete the body of each function below.
 *   2. Replace with `fetch('/api/...')` calls.
 *   3. Keep the same exported signatures and return types.
 */

import type {
  AnalyzeResult,
  DetectedItem,
  GroceryItem,
  GroceryList,
  MealEntry,
  NutrientContribution,
  PipelineTrace,
  ResolveNutritionResult,
  ResolvedItem,
  UserStats,
  UserProfile,
} from '../types/schemas';
import { resolveDailyKcalTarget } from '../types/schemas';
import * as storage from './storage';
import {
  MOCK_DETECTED,
  MOCK_GROCERY_GROUPS,
  MOCK_NUTRITION_DB,
  MOCK_PROFILE,
  MOCK_TARGETS,
} from '../mocks/fixtures';

// ── In-memory mutable state (pretends to be a backend session) ──────────

let profileState: UserProfile = storage.loadOrDefault('profile', structuredClone(MOCK_PROFILE));
let groceryState: GroceryItem[] = MOCK_GROCERY_GROUPS.flatMap((g) => g.items);
let budgetState = MOCK_PROFILE.budget;
let nextGroceryId = 100;
let historyState: MealEntry[] = storage.loadOrDefault('meal_history', []);

// ── Utility ─────────────────────────────────────────────────────────────

// @demo-only — replace with real fetch() when backend lands.
// The random delay simulates realistic network latency so the UI feels real.
// Keep Math.random() so screenshots / Playwright snapshots are not deterministic.
function delay(min: number, max: number): Promise<void> {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Canonical, factory-fresh profile used for Reset.
 *
 * DO NOT mutate this — always `structuredClone` it before handing it to
 * `updateProfile`. The mock state in `profileState` starts as a clone of
 * this and diverges as the user makes changes; this constant is the
 * single source of truth for "what a fresh user looks like".
 */
export const DEFAULT_PROFILE: UserProfile = structuredClone(MOCK_PROFILE);

function makeTrace(stage: PipelineTrace['stage'], label: string, status: PipelineTrace['status'] = 'done'): PipelineTrace {
  return { stage, status, startedAt: Date.now(), finishedAt: Date.now(), label };
}

// ── Vision pipeline ─────────────────────────────────────────────────────────────────

/**
 * POST /api/vision/analyze  →  { detected, pipeline }
 * Runs the dual vision pipeline (Gemini + HF validator) and returns ranked
 * detected items with a per-stage trace.
 */
export async function analyzeMeal(_imageRef: string): Promise<AnalyzeResult> {
  // Simulate the pipeline firing off stage-by-stage with a trace
  const pipeline: PipelineTrace[] = [
    makeTrace('cache-check', 'Cache check', 'cache-hit'),
    makeTrace('vision-id', 'Vision ID (Gemini)', 'done'),
    makeTrace('hf-validate', 'HF validator', 'done'),
    makeTrace('reconcile', 'Confidence-weighted reconcile', 'done'),
  ];
  await delay(180, 320);
  return { detected: structuredClone(MOCK_DETECTED), pipeline };
}

// ── Nutrition resolution ────────────────────────────────────────────────────────────

/**
 * POST /api/nutrition/resolve  →  { resolved, contributions }
 * Runs the OFF → USDA → Fruityvice cascade (mocked as cache hit) and emits
 * SHAP-style contributions for the explainability panel.
 */
export async function resolveNutrition(
  items: DetectedItem[],
  profile?: UserProfile,
): Promise<ResolveNutritionResult> {
  await delay(160, 280);

  const resolved: ResolvedItem[] = items.map((it) => {
    const descriptor = MOCK_NUTRITION_DB[it.name] ?? null;
    return {
      ...it,
      descriptor,
      nutrition: descriptor
        ? {
            protein: descriptor.protein,
            carbs: descriptor.carbs,
            fat: descriptor.fat,
            kcal: descriptor.kcal,
            fiber: descriptor.fiber,
            sodium: descriptor.sodium,
            sugar: descriptor.sugar,
            glycemic: descriptor.glycemic,
          }
        : null,
      source: descriptor ? 'cache' : 'estimated',
      partial: descriptor == null,
    };
  });

  // Compute totals per nutrient for share calc
  const totals: Record<string, number> = {
    sodium: 0, sugar: 0, fiber: 0, protein: 0, carbs: 0, fat: 0, kcal: 0,
  };
  const nutrientKeys = ['sodium', 'sugar', 'fiber', 'protein', 'carbs', 'fat', 'kcal'] as const;
  for (const r of resolved) {
    if (!r.nutrition) continue;
    const factor = r.grams / 100;
    for (const k of nutrientKeys) {
      totals[k] += r.nutrition[k] * factor;
    }
  }

  // Emit a contribution per (nutrient, item) for flagged nutrients.
  // Each contribution carries a short, item-specific verdict string so the
  // Nutrients screen can render per-item verdict chips and a one-sentence
  // "meal verdict" without re-computing the math on the client.
  const contributions: NutrientContribution[] = [];
  const flagRules: Array<{
    nutrient: NutrientContribution['nutrient'];
    threshold: number; // absolute value above which to flag
    reasonIfHigh: (itemName: string, amount: number) => string;
    reasonIfLow?: (itemName: string, amount: number) => string;
    lowThreshold?: number;
    unit?: 'g' | 'mg';
  }> = [
    {
      nutrient: 'sodium',
      threshold: MOCK_TARGETS.sodium,
      reasonIfHigh: (n, a) => `${n} adds ${Math.round(a)}mg sodium — that's ${Math.round((a / MOCK_TARGETS.sodium) * 100)}% of your daily cap in one item.`,
    },
    {
      nutrient: 'sugar',
      threshold: MOCK_TARGETS.sugar,
      reasonIfHigh: (n, a) => `${n} brings ${a.toFixed(1)}g of sugar — a notable spike for a prediabetic-friendly plate.`,
      reasonIfLow: (n, a) => `${n} contributes only ~${a.toFixed(1)}g of sugar — well within your prediabetic-friendly target.`,
      lowThreshold: MOCK_TARGETS.sugar * 0.6, // emit low-sugar chips when total ≤ 60% of cap
    },
    {
      nutrient: 'fiber',
      threshold: MOCK_TARGETS.fiber,
      reasonIfHigh: (n, a) => `${n} is a solid fiber source at ${a.toFixed(1)}g — pulls the meal toward target.`,
      reasonIfLow: (n, a) => `${n} contributes only ~${a.toFixed(1)}g fiber — the whole meal falls short of your 30g daily target. Add whole grains or legumes next time.`,
      lowThreshold: 12,
    },
    {
      nutrient: 'protein',
      threshold: MOCK_TARGETS.protein,
      reasonIfHigh: (n, a) => `${n} delivers ${a.toFixed(1)}g of protein — strong for a single dish.`,
      reasonIfLow: (n, a) => `${n} is light on protein (~${a.toFixed(1)}g) — consider adding dal or paneer.`,
    },
  ];

  for (const rule of flagRules) {
    const total = totals[rule.nutrient];
    // The nutrient is "in play" for the user's profile if it's tracked for
    // their goals. We emit explanations for two reasons:
    //   (a) the meal is OVER target — flag the top contributor(s) as 'warn'
    //   (b) the meal is UNDER target by a lot (≤ lowThreshold) — call out
    //       the *low* contribution so the user sees what's missing
    // Both paths populate the verdict chip list so the panel never appears
    // empty for a non-trivial meal.
    const nutrientIsFlaggedForProfile = profile?.goals.diabetic
      ? rule.nutrient === 'sugar' || rule.nutrient === 'fiber'
      : rule.nutrient === 'sodium' || rule.nutrient === 'fiber';
    if (!nutrientIsFlaggedForProfile) continue;
    const mealOverTarget = total > rule.threshold;
    const mealUnderTarget = rule.lowThreshold != null && total < rule.lowThreshold;
    if (!mealOverTarget && !mealUnderTarget) continue;
    for (const r of resolved) {
      if (!r.nutrition) continue;
      const amount = r.nutrition[rule.nutrient] * (r.grams / 100);
      const share = total > 0 ? amount / total : 0;
      if (share < 0.10) continue;
      const tone: 'good' | 'warn' = mealOverTarget && share >= 0.30 ? 'warn' : 'good';
      const reason = tone === 'warn'
        ? rule.reasonIfHigh(r.name, amount)
        : rule.reasonIfLow
          ? rule.reasonIfLow(r.name, amount)
          : undefined;
      if (!reason) continue;
      contributions.push({
        nutrient: rule.nutrient,
        itemName: r.name,
        amount,
        share,
        flagged: tone === 'warn',
        reason,
        tone,
      });
    }
  }

  return { resolved, contributions };
}

// ── Profile ────────────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile> {
  await delay(80, 160);
  return structuredClone(profileState);
}

export async function updateProfile(p: UserProfile): Promise<UserProfile> {
  await delay(120, 220);
  profileState = structuredClone(p);
  storage.save('profile', profileState);
  return structuredClone(profileState);
}

// ── Grocery list ───────────────────────────────────────────────────────────────────

export async function getGroceryList(profile: UserProfile): Promise<GroceryList> {
  await delay(120, 220);
  budgetState = profile.budget;
  return {
    budget: budgetState,
    groups: MOCK_GROCERY_GROUPS.map((g) => ({
      category: g.category,
      items: g.items.map((i) => ({ ...i })),
    })),
  };
}

export async function addGroceryItem(
  _category: string,
  name: string,
  price: number,
): Promise<GroceryItem> {
  await delay(80, 160);
  const item: GroceryItem = {
    id: `g-new-${nextGroceryId++}`,
    name,
    price: Math.max(0, price),
    checked: false,
  };
  groceryState.push(item);
  return item;
}

export async function removeGroceryItem(itemId: string): Promise<void> {
  await delay(60, 120);
  groceryState = groceryState.filter((i) => i.id !== itemId);
}

export async function updateGroceryPrice(itemId: string, price: number): Promise<void> {
  await delay(60, 120);
  const it = groceryState.find((i) => i.id === itemId);
  if (it) it.price = Math.max(0, Math.min(9999, price));
}

export async function toggleGroceryItem(itemId: string): Promise<void> {
  await delay(40, 80);
  const it = groceryState.find((i) => i.id === itemId);
  if (it) it.checked = !it.checked;
}

export async function clearGroceryList(): Promise<void> {
  await delay(60, 120);
  groceryState = [];
}

// ── Meal history ─────────────────────────────────────────────────────────────────

/** Save a completed meal to history. Persists to localStorage. */
export async function saveMeal(entry: Omit<MealEntry, 'id' | 'date'>): Promise<MealEntry> {
  await delay(60, 120);
  const saved: MealEntry = {
    ...entry,
    id: `meal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
  };
  historyState = [saved, ...historyState];
  storage.save('meal_history', historyState);
  return structuredClone(saved);
}

/** Get full meal history, most recent first. */
export async function getMealHistory(): Promise<MealEntry[]> {
  await delay(40, 80);
  historyState = storage.loadOrDefault('meal_history', []);
  return structuredClone(historyState);
}

/** Get meals logged today.
 *
 * Macros are returned as grams, kcal as raw kcal. `dailyKcalTarget` is
 * resolved from the *currently loaded* profile (falls back to the universal
 * default if absent) so the Home progress bar can render without the screen
 * having to load the profile separately.
 *
 * `mealsLogged: 0` plus all-zero totals is the canonical "no meals yet"
 * shape — Home uses it to render an empty state instead of hiding the card.
 */
export async function getTodaySummary(): Promise<{
  mealsLogged: number;
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  dailyKcalTarget: number;
}> {
  await delay(40, 80);
  historyState = storage.loadOrDefault('meal_history', []);
  const today = new Date().toISOString().slice(0, 10);
  const todayMeals = historyState.filter((m) => m.date.startsWith(today));
  return {
    mealsLogged: todayMeals.length,
    totalKcal: todayMeals.reduce((s, m) => s + m.totals.kcal, 0),
    totalProtein: todayMeals.reduce((s, m) => s + m.totals.protein, 0),
    totalCarbs: todayMeals.reduce((s, m) => s + m.totals.carbs, 0),
    totalFat: todayMeals.reduce((s, m) => s + m.totals.fat, 0),
    dailyKcalTarget: resolveDailyKcalTarget(profileState),
  };
}

/** Get aggregated user statistics for the profile screen. */
export async function getUserStats(): Promise<UserStats> {
  await delay(40, 80);
  historyState = storage.loadOrDefault('meal_history', []);
  if (historyState.length === 0) {
    return { totalMeals: 0, totalDaysActive: 0, avgDailyKcal: 0, streakDays: 0 };
  }
  const days = new Set(historyState.map((m) => m.date.slice(0, 10)));
  const totalKcal = historyState.reduce((s, m) => s + m.totals.kcal, 0);
  return {
    totalMeals: historyState.length,
    totalDaysActive: days.size,
    avgDailyKcal: Math.round(totalKcal / days.size),
    streakDays: days.size, // simplified streak for demo
  };
}

/** Delete a meal from history. */
export async function deleteMeal(mealId: string): Promise<void> {
  await delay(40, 80);
  historyState = historyState.filter((m) => m.id !== mealId);
  storage.save('meal_history', historyState);
}

// ── Aggregate targets (small helper for NutrientsScreen) ────────────────────────────

export function getMacroTargets() {
  return { ...MOCK_TARGETS };
}