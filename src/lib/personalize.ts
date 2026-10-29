/**
 * Personalize / explainability layer — single source of truth.
 *
 * The flag-rules table and the per-profile nutrient focus map live here
 * so the mock `api.ts#resolveNutrition` (frontend) and the NutrientsScreen
 * verdict UI can't drift. The backend mirrors the same shape in
 * `app/api/personalize.py`.
 */

import type {
  ActivityLevel,
  GoalType,
  MacroTargets,
  NutritionFacts,
  NutrientContribution,
  Sex,
  UserProfile,
} from '../types/schemas';
import { MOCK_TARGETS, MOCK_NUTRITION_DB } from '../mocks/fixtures';
import { toBengaliDigits } from './format';

export interface BiometricsBreakdown {
  bmr: number;
  tdee: number;
  recommendedKcal: number;
  deficitOrSurplus: number;
  safetyFloor: number;
  isFloored: boolean;
  explanation: string;
}

/**
 * Calculates BMR (Mifflin-St Jeor), TDEE, and safe daily calorie recommendation.
 * Mirrors `app/services/targets.py` on the client.
 */
export function calculateBiometricsBreakdown(
  profile?: {
    age?: number | null;
    sex?: Sex | null;
    heightCm?: number | null;
    weightKg?: number | null;
    activityLevel?: ActivityLevel | null;
    goal?: GoalType | null;
    targetRateKgPerWeek?: number | null;
  } | null,
  lang: 'en' | 'bn' = 'en',
): BiometricsBreakdown {
  const age = Math.max(1, profile?.age ?? 28);
  const sex = profile?.sex ?? 'male';
  const weight = Math.max(10, profile?.weightKg ?? 70);
  const height = Math.max(50, profile?.heightCm ?? 172);
  const activity = profile?.activityLevel ?? 'moderate';
  const goal = profile?.goal ?? 'maintain';
  const rate = Math.max(0, Math.min(1.0, profile?.targetRateKgPerWeek ?? 0.5));

  // Mifflin-St Jeor equation: (10 × W) + (6.25 × H) - (5 × A) + s
  let offset = -78;
  if (sex === 'male') offset = 5;
  else if (sex === 'female') offset = -161;

  const bmr = Math.max(600, Math.round(10 * weight + 6.25 * height - 5 * age + offset));

  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const mult = activityMultipliers[activity] ?? 1.55;
  const tdee = Math.round(bmr * mult);

  let delta = 0;
  if (goal === 'lose') {
    const weeklyCal = (rate > 0 ? rate : 0.5) * 7700;
    delta = -Math.min(1000, Math.round(weeklyCal / 7));
  } else if (goal === 'gain') {
    const weeklyCal = (rate > 0 ? rate : 0.5) * 7700;
    delta = Math.min(750, Math.round(weeklyCal / 7));
  }

  let recommended = tdee + delta;
  const floor = age < 12 ? 1000 : sex === 'female' ? 1200 : 1500;
  const isFloored = recommended < floor;
  if (isFloored) {
    recommended = floor;
  }

  const actMapBn: Record<string, string> = {
    sedentary: 'বসে কাজ',
    light: 'হালকা ব্যায়াম',
    moderate: 'মাঝারি ব্যায়াম',
    active: 'খুব সক্রিয়',
    very_active: 'অতিরিক্ত পরিশ্রম',
  };
  const actText = lang === 'bn' ? (actMapBn[activity] || activity) : activity;

  let explanation = '';
  if (lang === 'bn') {
    const bmrBn = toBengaliDigits(bmr);
    const multBn = toBengaliDigits(mult);
    const tdeeBn = toBengaliDigits(tdee);
    explanation = `বিএমআর ${bmrBn} কিলোক্যালরি (মিফলিন-সেন্ট জিওর) × ${multBn} (${actText}) = মোট দৈনিক ব্যয় (টিডিইই) ${tdeeBn} কিলোক্যালরি।`;
    if (goal === 'lose') {
      explanation += ` নিরাপদ চর্বি কমানোর ঘাটতি: ${toBengaliDigits(Math.abs(delta))} কিলোক্যালরি/দিন।`;
    } else if (goal === 'gain') {
      explanation += ` ক্যালরি বৃদ্ধির উদ্বৃত্ত: +${toBengaliDigits(delta)} কিলোক্যালরি/দিন।`;
    }
    if (isFloored) {
      explanation += ` স্বাস্থ্য সুরক্ষা সীমা: দৈনিক সর্বনিম্ন ${toBengaliDigits(floor)} কিলোক্যালরি প্রয়োগ করা হয়েছে।`;
    }
  } else {
    explanation = `BMR ${bmr} kcal (Mifflin-St Jeor) × ${mult} (${activity}) = TDEE ${tdee} kcal.`;
    if (goal === 'lose') {
      explanation += ` Loss deficit: ${Math.abs(delta)} kcal/day.`;
    } else if (goal === 'gain') {
      explanation += ` Surplus: +${delta} kcal/day.`;
    }
    if (isFloored) {
      explanation += ` Safety floor enforced: min ${floor} kcal/day.`;
    }
  }

  return {
    bmr,
    tdee,
    recommendedKcal: Math.round(recommended),
    deficitOrSurplus: delta,
    safetyFloor: floor,
    isFloored,
    explanation,
  };
}

// ── Dynamic Target Engine (Client mirror) ──────────────────────────────

export function getDynamicTargets(profile?: UserProfile | null): MacroTargets {
  if (!profile) return { ...MOCK_TARGETS };

  const age = profile.age ?? 30;
  const sex = profile.sex ?? 'other';
  const weight = profile.weightKg ?? 68;
  const height = profile.heightCm ?? 168;
  const activity = profile.activityLevel ?? 'sedentary';
  const goal = profile.goal ?? 'maintain';
  const conditions = profile.medicalConditions ?? [];
  const isDiabetic =
    conditions.includes('diabetes_t1') ||
    conditions.includes('diabetes_t2') ||
    conditions.includes('prediabetes') ||
    !!profile.goals.diabetic;
  const isHypertensive = conditions.includes('hypertension');
  const isKidney = conditions.includes('kidney');
  const isHighProtein = !!profile.goals.protein;

  // BMR via Mifflin-St Jeor
  let offset = -78;
  if (sex === 'male') offset = 5;
  else if (sex === 'female') offset = -161;
  const bmr = 10 * weight + 6.25 * height - 5 * age + offset;

  // TDEE via activity factor
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const tdee = bmr * (activityMultipliers[activity] ?? 1.2);

  // Calorie target
  let calories = tdee;
  if (goal === 'lose') {
    calories -= 500;
  } else if (goal === 'gain') {
    calories += 400;
  }

  // Clinical safety floors
  const floor = age < 12 ? 1000 : sex === 'female' ? 1200 : 1500;
  calories = Math.max(floor, calories);

  if (profile.dailyKcalTarget && profile.dailyKcalTarget > 500) {
    calories = profile.dailyKcalTarget;
  }

  // Macro split
  let carbPct = 0.5;
  let protPct = 0.2;
  let fatPct = 0.3;
  if (isDiabetic) {
    carbPct = 0.38;
    protPct = 0.25;
    fatPct = 0.37;
  } else if (isHighProtein) {
    carbPct = 0.4;
    protPct = 0.32;
    fatPct = 0.28;
  }

  let proteinG = Math.round((calories * protPct) / 4);
  const carbsG = Math.round((calories * carbPct) / 4);
  const fatG = Math.round((calories * fatPct) / 9);

  if (isKidney) {
    proteinG = Math.min(proteinG, Math.round(weight * 0.8));
  }

  // Fiber
  let fiberG = Math.round((calories / 1000) * 14);
  if (age < 14) {
    fiberG = Math.min(age + 5, fiberG);
  } else if (isDiabetic) {
    fiberG = Math.max(30, fiberG);
  }

  // Sodium
  let sodiumMg = 2300;
  if (isHypertensive || isKidney) {
    sodiumMg = 1500;
  } else if (age < 8) {
    sodiumMg = 1200;
  }

  // Sugar
  const sugarPct = isDiabetic ? 0.05 : 0.1;
  const sugarG = Math.round((calories * sugarPct) / 4);

  return {
    kcal: Math.round(calories),
    protein: proteinG,
    carbs: carbsG,
    fat: fatG,
    fiber: fiberG,
    sodium: sodiumMg,
    sugar: sugarG,
  };
}

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
  const targets = getDynamicTargets(profile);
  return profile.goals.diabetic
    ? [
        { nutrient: 'sugar', threshold: targets.sugar },
        { nutrient: 'fiber', threshold: targets.fiber },
      ]
    : [
        { nutrient: 'sodium', threshold: targets.sodium },
        { nutrient: 'fiber', threshold: targets.fiber },
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

/**
 * Resolve effective nutrition facts for any food item.
 * Falls back gracefully to case-insensitive dictionary lookups,
 * domain culinary heuristics, and category estimates when an item
 * is not found in the primary databases.
 */
export function getEffectiveNutrition(
  name: string,
  nutrition?: NutritionFacts | null,
): NutritionFacts {
  if (nutrition && (nutrition.kcal > 0 || nutrition.protein > 0 || nutrition.carbs > 0)) {
    return nutrition;
  }
  const lower = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(MOCK_NUTRITION_DB)) {
    if (k.toLowerCase().trim() === lower) {
      return v;
    }
  }
  if (
    lower.includes('rice') ||
    lower.includes('grain') ||
    lower.includes('khichuri') ||
    lower.includes('biryani') ||
    lower.includes('roti') ||
    lower.includes('bread') ||
    lower.includes('paratha')
  ) {
    return { protein: 3.5, carbs: 26.0, fat: 2.5, kcal: 145, fiber: 1.2, sodium: 180, sugar: 0.5, glycemic: 0.65 };
  }
  if (
    lower.includes('dal') ||
    lower.includes('lentil') ||
    lower.includes('soup') ||
    lower.includes('bean')
  ) {
    return { protein: 9.0, carbs: 18.0, fat: 1.5, kcal: 120, fiber: 6.5, sodium: 240, sugar: 1.5, glycemic: 0.25 };
  }
  if (
    lower.includes('chicken') ||
    lower.includes('beef') ||
    lower.includes('meat') ||
    lower.includes('curry') ||
    lower.includes('mutton') ||
    lower.includes('kebab')
  ) {
    return { protein: 22.0, carbs: 4.0, fat: 7.0, kcal: 170, fiber: 0.5, sodium: 340, sugar: 0.8, glycemic: 0.20 };
  }
  if (
    lower.includes('fish') ||
    lower.includes('salmon') ||
    lower.includes('shrimp') ||
    lower.includes('seafood') ||
    lower.includes('macher')
  ) {
    return { protein: 20.0, carbs: 1.5, fat: 4.5, kcal: 130, fiber: 0.2, sodium: 210, sugar: 0.2, glycemic: 0.05 };
  }
  if (
    lower.includes('egg') ||
    lower.includes('dim') ||
    lower.includes('omelet')
  ) {
    return { protein: 12.5, carbs: 1.0, fat: 9.5, kcal: 143, fiber: 0.0, sodium: 140, sugar: 0.5, glycemic: 0.00 };
  }
  if (
    lower.includes('salad') ||
    lower.includes('vegetable') ||
    lower.includes('veggie') ||
    lower.includes('bhorta') ||
    lower.includes('bhaji') ||
    lower.includes('cucumber') ||
    lower.includes('raita')
  ) {
    return { protein: 2.0, carbs: 5.5, fat: 1.0, kcal: 40, fiber: 2.2, sodium: 60, sugar: 2.5, glycemic: 0.10 };
  }
  if (
    lower.includes('fruit') ||
    lower.includes('apple') ||
    lower.includes('banana') ||
    lower.includes('mango') ||
    lower.includes('berry')
  ) {
    return { protein: 0.8, carbs: 18.0, fat: 0.3, kcal: 75, fiber: 2.5, sodium: 2, sugar: 14.0, glycemic: 0.35 };
  }
  return { protein: 5.0, carbs: 15.0, fat: 3.5, kcal: 110, fiber: 1.5, sodium: 150, sugar: 1.5, glycemic: 0.30 };
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