/**
 * Personalize / explainability layer — single source of truth.
 *
 * The flag-rules table and the per-profile nutrient focus map live here
 * so the mock `api.ts#resolveNutrition` (frontend) and the NutrientsScreen
 * verdict UI can't drift. The backend mirrors the same shape in
 * `app/api/personalize.py`.
 */

import type { NutritionFacts, NutrientContribution, UserProfile } from '../types/schemas';
import { MOCK_TARGETS } from '../mocks/fixtures';

// ── Nutrient focus per profile ──────────────────────────────────────────
// Diabetic profiles care about sugar + fiber; everyone else sodium + fiber.
function focusFor(diabetic: boolean): ReadonlySet<string> {
  return diabetic ? new Set(['sugar', 'fiber']) : new Set(['sodium', 'fiber']);
}

export function isNutrientFocused(nutrient: string, profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return focusFor(profile.goals.diabetic).has(nutrient);
}

/** The list of flagged nutrients to render on NutrientsScreen (the "Why these flags?" strip). */
export function focusedNutrients(profile: UserProfile | null | undefined): ReadonlyArray<{ nutrient: 'sodium' | 'sugar' | 'fiber'; threshold: number }> {
  if (!profile) return [];
  return profile.goals.diabetic
    ? [
        { nutrient: 'sugar', threshold: MOCK_TARGETS.sugar },
        { nutrient: 'fiber', threshold: MOCK_TARGETS.fiber },
      ]
    : [
        { nutrient: 'sodium', threshold: MOCK_TARGETS.sodium },
        { nutrient: 'fiber', threshold: MOCK_TARGETS.fiber },
      ];
}

// ── Flag rules (the SHAP-style contribution engine) ─────────────────────

export type FlagReason = (name: string, amount: number) => string;

interface FlagRule {
  nutrient: NutrientContribution['nutrient'];
  threshold: number;
  reasonIfHigh: FlagReason;
  reasonIfLow?: FlagReason;
  lowThreshold?: number;
  /** "g" or "mg" — controls the formatting precision in the verdict. */
  unit: 'g' | 'mg';
}

export const FLAG_RULES: readonly FlagRule[] = [
  {
    nutrient: 'sodium',
    threshold: MOCK_TARGETS.sodium,
    unit: 'mg',
    reasonIfHigh: (n, a) =>
      `${n} adds ${Math.round(a)}mg sodium — that's ${Math.round((a / MOCK_TARGETS.sodium) * 100)}% of your daily cap in one item.`,
  },
  {
    nutrient: 'sugar',
    threshold: MOCK_TARGETS.sugar,
    unit: 'g',
    reasonIfHigh: (n, a) =>
      `${n} brings ${a.toFixed(1)}g of sugar — a notable spike for a prediabetic-friendly plate.`,
    reasonIfLow: (n, a) =>
      `${n} contributes only ~${a.toFixed(1)}g of sugar — well within your prediabetic-friendly target.`,
    lowThreshold: MOCK_TARGETS.sugar * 0.6,
  },
  {
    nutrient: 'fiber',
    threshold: MOCK_TARGETS.fiber,
    unit: 'g',
    reasonIfHigh: (n, a) =>
      `${n} is a solid fiber source at ${a.toFixed(1)}g — pulls the meal toward target.`,
    reasonIfLow: (n, a) =>
      `${n} contributes only ~${a.toFixed(1)}g fiber — the whole meal falls short of your 30g daily target. Add whole grains or legumes next time.`,
    lowThreshold: 12,
  },
  {
    nutrient: 'protein',
    threshold: MOCK_TARGETS.protein,
    unit: 'g',
    reasonIfHigh: (n, a) =>
      `${n} delivers ${a.toFixed(1)}g of protein — strong for a single dish.`,
    reasonIfLow: (n, a) =>
      `${n} is light on protein (~${a.toFixed(1)}g) — consider adding dal or paneer.`,
  },
];

/** The 7 nutrients the resolver sums over (per-100g scaling). */
export const NUTRIENT_KEYS = [
  'sodium', 'sugar', 'fiber', 'protein', 'carbs', 'fat', 'kcal',
] as const;

/** Sum one resolved item's grams-scaled contribution to a single nutrient. */
export function itemAmount(
  nutrition: NutritionFacts,
  nutrient: string,
  grams: number,
): number {
  return (nutrition as unknown as Record<string, number>)[nutrient] * (grams / 100);
}

/** Display unit for a given nutrient, read from the rule table. Mirrors the
 *  backend's per-nutrient unit conventions (sodium is milligrams, everything
 *  else is grams). Callers — e.g. NutrientsScreen — should prefer this over a
 *  hard-coded ternary so adding a new unit (mg for sugar, etc.) doesn't drift. */
export function unitForNutrient(nutrient: NutrientContribution['nutrient']): 'g' | 'mg' {
  const rule = FLAG_RULES.find((r) => r.nutrient === nutrient);
  return rule?.unit ?? 'g';
}

/**
 * Compute per-nutrient meal totals across all resolved items.
 * Items without `nutrition` are skipped — they can't contribute to the share.
 */
export function mealTotals<T extends { nutrition: NutritionFacts | null; grams: number }>(
  resolved: readonly T[],
): Record<typeof NUTRIENT_KEYS[number], number> {
  const totals = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as Record<typeof NUTRIENT_KEYS[number], number>;
  for (const r of resolved) {
    if (!r.nutrition) continue;
    const factor = r.grams / 100;
    for (const k of NUTRIENT_KEYS) {
      totals[k] += (r.nutrition as unknown as Record<string, number>)[k] * factor;
    }
  }
  return totals;
}

/** Build a per-nutrient list of contributions, applying the rule table + profile focus. */
export function buildContributions(
  resolved: ReadonlyArray<{ name: string; grams: number; nutrition: NutritionFacts | null }>,
  totals: Record<string, number>,
  profile: UserProfile | null | undefined,
): NutrientContribution[] {
  const out: NutrientContribution[] = [];
  for (const rule of FLAG_RULES) {
    if (!isNutrientFocused(rule.nutrient, profile)) continue;
    const total = totals[rule.nutrient] ?? 0;
    const mealOver = total > rule.threshold;
    const mealUnder = rule.lowThreshold != null && total < rule.lowThreshold;
    if (!mealOver && !mealUnder) continue;
    for (const r of resolved) {
      if (!r.nutrition) continue;
      const amount = itemAmount(r.nutrition, rule.nutrient, r.grams);
      const share = total > 0 ? amount / total : 0;
      if (share < 0.10) continue;
      const tone: 'warn' | 'good' = mealOver && share >= 0.30 ? 'warn' : 'good';
      const reason = tone === 'warn'
        ? rule.reasonIfHigh(r.name, amount)
        : rule.reasonIfLow?.(r.name, amount);
      if (!reason) continue;
      out.push({
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
  return out;
}