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
  NutrientContribution,
  PipelineTrace,
  ResolveNutritionResult,
  ResolvedItem,
  UserProfile,
} from '../types/schemas';
import {
  MOCK_DETECTED,
  MOCK_GROCERY_GROUPS,
  MOCK_NUTRITION_DB,
  MOCK_PROFILE,
  MOCK_TARGETS,
} from '../mocks/fixtures';

// ── In-memory mutable state (pretends to be a backend session) ──────────

let profileState: UserProfile = structuredClone(MOCK_PROFILE);
let groceryState: GroceryItem[] = MOCK_GROCERY_GROUPS.flatMap((g) => g.items);
let budgetState = MOCK_PROFILE.budget;
let nextGroceryId = 100;

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

  // Emit a contribution per (nutrient, item) for flagged nutrients
  const contributions: NutrientContribution[] = [];
  const flagRules: Array<{
    nutrient: NutrientContribution['nutrient'];
    threshold: number; // absolute value above which to flag
    reasonIfHigh: string;
    reasonIfLow?: string;
    lowThreshold?: number;
  }> = [
    { nutrient: 'sodium',  threshold: MOCK_TARGETS.sodium,  reasonIfHigh: 'above daily target' },
    { nutrient: 'sugar',   threshold: MOCK_TARGETS.sugar,   reasonIfHigh: 'added sugar spike',   reasonIfLow: 'low — fine in moderation' },
    { nutrient: 'fiber',   threshold: MOCK_TARGETS.fiber,   reasonIfHigh: 'good fiber',          reasonIfLow: 'low fiber — consider produce', lowThreshold: 12 },
    { nutrient: 'protein', threshold: MOCK_TARGETS.protein, reasonIfHigh: 'strong protein',      reasonIfLow: 'low protein' },
  ];

  for (const rule of flagRules) {
    const total = totals[rule.nutrient];
    const flagged = profile?.goals.diabetic
      ? rule.nutrient === 'sugar' || rule.nutrient === 'fiber'
      : rule.nutrient === 'sodium' || rule.nutrient === 'fiber';
    for (const r of resolved) {
      if (!r.nutrition) continue;
      const amount = r.nutrition[rule.nutrient] * (r.grams / 100);
      const share = total > 0 ? amount / total : 0;
      if (share < 0.05) continue; // skip negligible contributions
      const localFlag = flagged && (rule.nutrient === 'sodium' ? amount > 300 : rule.nutrient === 'sugar' ? amount > 15 : false);
      contributions.push({
        nutrient: rule.nutrient,
        itemName: r.name,
        amount,
        share,
        flagged: localFlag,
        reason: localFlag ? rule.reasonIfHigh : undefined,
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

// ── Aggregate targets (small helper for NutrientsScreen) ────────────────────────────

export function getMacroTargets() {
  return { ...MOCK_TARGETS };
}