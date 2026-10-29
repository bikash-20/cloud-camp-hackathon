/**
 * API client.
 *
 * The vision and nutrition flows now call the real FastAPI backend
 * (`POST /api/vision/analyze`, `POST /api/nutrition/resolve`). The
 * backend URL is read from `VITE_API_BASE` at build time (Vercel
 * dashboard → Settings → Environment Variables). On localhost, the
 * fallback is `http://localhost:8000` which assumes `uvicorn
 * app.main:app --reload --port 8000` is running.
 *
 * Profile, grocery, and meal history stay on localStorage so the
 * Home / Grocery / Profile screens keep their instant, offline
 * reads. Persisting those to the backend is a separate decision
 * (it would require reconciling the localStorage cache with the
 * `app/state.json` server state).
 *
 * If `VITE_API_BASE` is empty, vision analysis reports that the backend
 * is unavailable; nutrition may use its local demo lookup. Profile,
 * grocery, and meal-history operations remain browser-local either way.
 */

import type {
  AnalyzeResult,
  CoachChatRequest,
  CoachChatResponse,
  DetectedItem,
  GroceryGroup,
  GroceryItem,
  GroceryList,
  MealEntry,
  ResolveNutritionResult,
  ResolvedItem,
  TodaySummary,
  UserStats,
  UserProfile,
} from '../types/schemas';
import { resolveDailyKcalTarget } from '../types/schemas';
import * as storage from './storage';
import {
  MOCK_GROCERY_GROUPS,
  MOCK_NUTRITION_DB,
  MOCK_PROFILE,
  MOCK_TARGETS,
} from '../mocks/fixtures';
import { buildContributions, mealTotals } from './personalize';

// ── Backend wiring ──────────────────────────────────────────────────────

/**
 * Base URL of the FastAPI backend. Set on Vercel as
 * `VITE_API_BASE=https://your-service.onrender.com` so the
 * production PWA hits the live backend.
 */
const API_BASE: string = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000').replace(/\/+$/, '');

/** True when a backend URL is configured and we should hit it. */
const useLiveBackend = API_BASE.length > 0;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** POST/GET JSON helper. Throws `ApiError` on non-2xx. */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const body = await resp.json();
      if (body && typeof body === 'object' && 'detail' in body) {
        detail = String((body as { detail: unknown }).detail);
      }
    } catch {
      // Body wasn't JSON; fall back to statusText.
    }
    throw new ApiError(resp.status, `API ${resp.status}: ${detail}`);
  }
  // 204 No Content → return undefined cast.
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

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

// Simulated latency for local demo-state operations.
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

function clone<T>(v: T): T {
  return structuredClone(v);
}

// ── Vision pipeline ─────────────────────────────────────────────────────

/**
 * POST /api/vision/analyze  →  { detected, pipeline }
 * Runs the dual vision pipeline (Gemini + HF validator) and returns ranked
 * detected items with a per-stage trace.
 *
 * POSTs the image to the FastAPI backend. Analysis never substitutes a
 * canned meal when the backend is unreachable or not configured.
 */
export async function analyzeMeal(imageRef: string): Promise<AnalyzeResult> {
  if (!useLiveBackend) {
    throw new ApiError(0, 'Backend URL is not configured');
  }
  return apiFetch<AnalyzeResult>('/api/vision/analyze', {
    method: 'POST',
    body: JSON.stringify({ image_ref: imageRef }),
  });
}

// ── Nutrition resolution ────────────────────────────────────────────────

/**
 * POST /api/nutrition/resolve  →  { resolved, contributions }
 * Runs the OFF → USDA → Fruityvice cascade and emits SHAP-style
 * contributions for the explainability panel.
 *
 * Live mode: POSTs to the backend. The backend cascades through the
 * three external DBs, computes contributions against `profile`, and
 * returns the result.
 *
 * Mock mode (VITE_API_BASE=""): looks each item up in MOCK_NUTRITION_DB.
 */
export async function resolveNutrition(
  items: DetectedItem[],
  profile?: UserProfile,
): Promise<ResolveNutritionResult> {
  if (!useLiveBackend) {
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
  return apiFetch<ResolveNutritionResult>('/api/nutrition/resolve', {
    method: 'POST',
    body: JSON.stringify({ items, profile: profile ?? null }),
  });
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

export function calculateStreak(days: Set<string>): number {
  if (days.size === 0) return 0;
  const sortedDays = Array.from(days).sort().reverse();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const todayStr = toDateStr(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toDateStr(yesterday);

  let checkDate: Date;
  if (days.has(todayStr)) {
    checkDate = now;
  } else if (days.has(yesterdayStr)) {
    checkDate = yesterday;
  } else {
    const mostRecentStr = sortedDays[0];
    const parts = mostRecentStr.split('-').map(Number);
    checkDate = new Date(parts[0], parts[1] - 1, parts[2]);
  }

  let streak = 0;
  while (true) {
    const s = toDateStr(checkDate);
    if (days.has(s)) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
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
    streakDays: calculateStreak(days),
  };
}

/**
 * Send messages to Multi-Agent AI Coach (`POST /api/coach/chat`).
 */
export async function sendCoachChat(req: CoachChatRequest): Promise<CoachChatResponse> {
  if (useLiveBackend) {
    try {
      const res = await fetch(`${API_BASE}/api/coach/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (res.ok) {
        return (await res.json()) as CoachChatResponse;
      }
    } catch {
      // Degrade gracefully to local synthesis if backend call fails
    }
  }

  // Local fallback response
  const isScientist = req.agent_type === 'scientist';
  const lastMsg = req.messages[req.messages.length - 1]?.content || '';
  const isBn = /[\u0980-\u09FF]/.test(lastMsg);

  if (isScientist) {
    return {
      reply: isBn
        ? '🔬 **বায়োকেমিক্যাল পুষ্টি বিশ্লেষণ:**\n\n' +
          'খাবারের গ্লাইসেমিক লোড নিয়ন্ত্রণে রাখতে পর্যাপ্ত দ্রবণীয় ফাইবার (শাকসবজি) যুক্ত করুন এবং রান্নার তেলের পরিমাণ পরিমিত রাখুন। ' +
          'ভাতের সাথে এক বাটি ঘন ডাল বা মাছের ঝোল পেটের শূন্য হওয়ার গতি শ্লথ করে রক্তে শর্করার মাত্রা স্থিতিশীল রাখে।\n\n' +
          '[উৎস: BIRDEM ক্লিনিক্যাল গাইডলাইন ও INFS ডাটাবেজ]'
        : '🔬 **Nutritional Biochemical Analysis:**\n\n' +
          'To optimize the glycemic response of this meal, buffer carbs with dietary soluble fiber and protein. ' +
          'Cooling starches slightly increases resistant starch, helping flatten postprandial glucose curves.\n\n' +
          '[Source: BIRDEM Clinical Protocols & INFS Nutrition DB]',
      citations: ['BIRDEM ক্লিনিক্যাল গাইডলাইন', 'INFS খাদ্য ডাটাবেজ'],
      suggested_prompts: isBn
        ? [
            'এই খাবারের গ্লাইসেমিক লোড কীভাবে কমাব?',
            'রান্নায় তেল শোষণ কমানোর বৈজ্ঞানিক পদ্ধতি কী?',
            'বাজেট ফ্রেন্ডলি প্রোটিন উৎস কী কী?',
          ]
        : [
            'How do I lower the glycemic load of this meal?',
            'How to reduce cooking oil absorption?',
            'What are budget-friendly protein sources?',
          ],
      agent_type: 'scientist',
    };
  }

  return {
    reply: isBn
      ? '🧠 **আচরণ ও অভ্যাস কোচের বার্তা:**\n\n' +
        'খাবারের আনন্দ ও সংস্কৃতি উপভোগ করা জীবনের অংশ! কোনো খাবার নিয়ে অপরাধবোধ করার প্রয়োজন নেই। ' +
        'ছোট ছোট অভ্যাস যেমন খাবারের পর ১৫ মিনিটের শান্ত পদচারণা (শতপদ) এবং প্রচুর পানি পান আপনাকে সুস্থ ও সতেজ রাখতে সবচেয়ে কার্যকর।\n\n' +
        'আপনি দারুণভাবে এগিয়ে যাচ্ছেন! 💚'
      : '🧠 **Habit Coach Perspective:**\n\n' +
        'Food and cultural gatherings are meant to be enjoyed! Never let guilt hold you back. ' +
        'Small, compassionate habits like a relaxing 15-minute walk and mindful hydration build sustainable vitality.\n\n' +
        'You are doing great! 💚',
    citations: ['CBT ও অভ্যাস বিজ্ঞান', 'WHO লাইফস্টাইল গাইডলাইন'],
    suggested_prompts: isBn
      ? [
          'দাওয়াতে অতিরিক্ত খাওয়ার পর কী করব?',
          'রাতের মিষ্টি বা চায়ের আড্ডার লোভ কীভাবে সামলাব?',
          'ব্যস্ত দিনে হেলদি ডায়েট ধরে রাখার সহজ রুটিন কী?',
        ]
      : [
          'How to bounce back after a heavy feast?',
          'How to manage evening sweet cravings?',
          'Easy routines for healthy habits on busy days?',
        ],
    agent_type: 'behavioral',
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