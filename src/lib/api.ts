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
  GroceryGroup,
  GroceryItem,
  GroceryList,
  MealEntry,
  PipelineTrace,
  ResolveNutritionResult,
  ResolvedItem,
  TodaySummary,
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
import { buildContributions, mealTotals } from './personalize';

// ── In-memory mutable state (pretends to be a backend session) ──────────

let profileState: UserProfile = storage.loadOrDefault('profile', structuredClone(MOCK_PROFILE));
// Grocery items are persisted to localStorage so Clear All / Generate from
// Meals survive a page refresh. Older installs (pre-persistence) fall back
// to the seeded MOCK_GROCERY_GROUPS the first time we read.
let groceryState: GroceryItem[] = storage.load<GroceryItem[]>('grocery') ?? MOCK_GROCERY_GROUPS.flatMap((g) => g.items);
let budgetState = MOCK_PROFILE.budget;
let mealHistory: MealEntry[] = storage.loadOrDefault('meal_history', []);

// ── Persistence ─────────────────────────────────────────────────────────

function persist<T>(key: string, get: () => T): T {
  const value = get();
  storage.save(key, value);
  return value;
}

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

function clone<T>(v: T): T {
  return structuredClone(v);
}

// ── Vision pipeline ─────────────────────────────────────────────────────

/**
 * POST /api/vision/analyze  →  { detected, pipeline }
 * Runs the dual vision pipeline (Gemini + HF validator) and returns ranked
 * detected items with a per-stage trace.
 */
export async function analyzeMeal(_imageRef: string): Promise<AnalyzeResult> {
  const pipeline: PipelineTrace[] = [
    makeTrace('cache-check', 'Cache check', 'cache-hit'),
    makeTrace('vision-id', 'Vision ID (Gemini)', 'done'),
    makeTrace('hf-validate', 'HF validator', 'done'),
    makeTrace('reconcile', 'Confidence-weighted reconcile', 'done'),
  ];
  await delay(180, 320);
  return { detected: clone(MOCK_DETECTED), pipeline };
}

// ── Nutrition resolution ────────────────────────────────────────────────

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
      nutrition: descriptor ? { ...descriptor } : null,
      source: descriptor ? 'cache' : 'estimated',
      partial: descriptor == null,
    };
  });

  const totals = mealTotals(resolved);
  const contributions = buildContributions(resolved, totals, profile);
  return { resolved, contributions };
}

// ── Profile ─────────────────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile> {
  await delay(80, 160);
  return clone(profileState);
}

export async function updateProfile(p: UserProfile): Promise<UserProfile> {
  await delay(120, 220);
  profileState = clone(p);
  persist('profile', () => profileState);
  return clone(profileState);
}

// ── Grocery list ────────────────────────────────────────────────────────

// Built once at import — the seed data is immutable, so there's no reason
// to rebuild the id → category lookup on every call. Custom items
// (`g-new-*`) miss the map and fall through to the `Other` bucket.
const SEEDED_ID_TO_CATEGORY: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const g of MOCK_GROCERY_GROUPS) {
    for (const it of g.items) m.set(it.id, g.category);
  }
  return m;
})();

/**
 * Bucket the flat `groceryState` array back into display groups.
 *
 * Items added via `addGroceryItem` arrive without a category — they land
 * in `Other`. Items whose id matches a seeded mock group (`g-0-0`,
 * `g-1-2`, …) keep their original category. Order: seeded groups first,
 * then `Other` if non-empty.
 */
function bucketGroceryByCategory(items: GroceryItem[]): GroceryGroup[] {
  const byCat = new Map<string, GroceryItem[]>();
  for (const g of MOCK_GROCERY_GROUPS) byCat.set(g.category, []);
  const other: GroceryItem[] = [];
  for (const item of items) {
    const cat = SEEDED_ID_TO_CATEGORY.get(item.id);
    const bucket = cat != null ? byCat.get(cat) : undefined;
    (bucket ?? other).push(item);
  }
  const groups: GroceryGroup[] = MOCK_GROCERY_GROUPS.map((g) => ({
    category: g.category,
    items: byCat.get(g.category) ?? [],
  }));
  if (other.length > 0) groups.push({ category: 'Other', items: other });
  return groups;
}

export async function getGroceryList(profile: UserProfile): Promise<GroceryList> {
  await delay(120, 220);
  budgetState = profile.budget;
  return { budget: budgetState, groups: bucketGroceryByCategory(groceryState) };
}

function nextGroceryId(): string {
  // Walk the items every call rather than tracking a counter — the cost is
  // bounded (≤100 items in the demo) and avoids stale counter bugs after
  // a reload.
  let max = 0;
  for (const it of groceryState) {
    const n = parseInt(String(it.id).replace(/\D+/g, ''), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `g-new-${max + 1}`;
}

export async function addGroceryItem(
  _category: string,
  name: string,
  price: number,
): Promise<GroceryItem> {
  await delay(80, 160);
  const item: GroceryItem = {
    id: nextGroceryId(),
    name,
    price: Math.max(0, price),
    checked: false,
  };
  groceryState = [...groceryState, item];
  persist('grocery', () => groceryState);
  return item;
}

export async function removeGroceryItem(itemId: string): Promise<void> {
  await delay(60, 120);
  groceryState = groceryState.filter((i) => i.id !== itemId);
  persist('grocery', () => groceryState);
}

export async function updateGroceryPrice(itemId: string, price: number): Promise<void> {
  await delay(60, 120);
  const it = groceryState.find((i) => i.id === itemId);
  if (it) {
    it.price = Math.max(0, Math.min(9999, price));
    persist('grocery', () => groceryState);
  }
}

export async function toggleGroceryItem(itemId: string): Promise<void> {
  await delay(40, 80);
  const it = groceryState.find((i) => i.id === itemId);
  if (it) {
    it.checked = !it.checked;
    persist('grocery', () => groceryState);
  }
}

export async function clearGroceryList(): Promise<void> {
  await delay(60, 120);
  groceryState = [];
  persist('grocery', () => groceryState);
}

// ── Meal history ────────────────────────────────────────────────────────

/** Save a completed meal to history. Persists to localStorage. */
export async function saveMeal(entry: Omit<MealEntry, 'id' | 'date'>): Promise<MealEntry> {
  await delay(60, 120);
  const saved: MealEntry = {
    ...entry,
    id: `meal-${cryptoRandomId()}`,
    date: new Date().toISOString(),
  };
  mealHistory = [saved, ...mealHistory];
  persist('meal_history', () => mealHistory);
  return clone(saved);
}

/** Get full meal history, most recent first. */
export async function getMealHistory(): Promise<MealEntry[]> {
  await delay(40, 80);
  mealHistory = storage.loadOrDefault('meal_history', []);
  return clone(mealHistory);
}

/**
 * Get meals logged today.
 *
 * `mealsLogged: 0` plus all-zero totals is the canonical "no meals yet"
 * shape — Home uses it to render an empty state instead of hiding the card.
 * `dailyKcalTarget` resolves from the currently-loaded profile (falls back
 * to the universal default) so the Home progress bar can render without
 * loading the profile separately.
 */
export async function getTodaySummary(): Promise<TodaySummary> {
  await delay(40, 80);
  mealHistory = storage.loadOrDefault('meal_history', []);
  const today = new Date().toISOString().slice(0, 10);
  const todayMeals = mealHistory.filter((m) => m.date.startsWith(today));
  return {
    mealsLogged: todayMeals.length,
    totalKcal: sumField(todayMeals, 'kcal'),
    totalProtein: sumField(todayMeals, 'protein'),
    totalCarbs: sumField(todayMeals, 'carbs'),
    totalFat: sumField(todayMeals, 'fat'),
    dailyKcalTarget: resolveDailyKcalTarget(profileState),
  };
}

/** Get aggregated user statistics for the profile screen. */
export async function getUserStats(): Promise<UserStats> {
  await delay(40, 80);
  mealHistory = storage.loadOrDefault('meal_history', []);
  if (mealHistory.length === 0) {
    return { totalMeals: 0, totalDaysActive: 0, avgDailyKcal: 0, streakDays: 0 };
  }
  const days = new Set(mealHistory.map((m) => m.date.slice(0, 10)));
  const totalKcal = sumField(mealHistory, 'kcal');
  return {
    totalMeals: mealHistory.length,
    totalDaysActive: days.size,
    avgDailyKcal: Math.round(totalKcal / days.size),
    streakDays: days.size, // simplified streak for demo
  };
}

/** Delete a meal from history. */
export async function deleteMeal(mealId: string): Promise<void> {
  await delay(40, 80);
  mealHistory = mealHistory.filter((m) => m.id !== mealId);
  persist('meal_history', () => mealHistory);
}

// ── Aggregate targets (small helper for NutrientsScreen) ────────────────

export function getMacroTargets() {
  return { ...MOCK_TARGETS };
}

// ── Helpers (private) ───────────────────────────────────────────────────

function sumField(meals: readonly MealEntry[], field: 'kcal' | 'protein' | 'carbs' | 'fat'): number {
  let s = 0;
  for (const m of meals) s += m.totals[field];
  return s;
}

/**
 * Generate a stable id using `crypto.randomUUID()` where available,
 * falling back to a `Date.now + Math.random` combo for older browsers.
 * Either way the result is URL-safe and unique within a session.
 */
function cryptoRandomId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}