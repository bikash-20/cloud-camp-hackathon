/**
 * Diet-Conflict and Clinical Warning Engine for NutriVision AI.
 *
 * Checks detected foods and resolved nutrients against the user's active
 * profile:
 *   - Halal violations (pork, bacon, ham, lard, alcohol, wine, gelatin)
 *   - Vegetarian violations (beef, chicken, mutton, fish, shrimp, pork, poultry)
 *   - Vegan violations (meat, poultry, seafood, dairy, eggs, ghee, butter, honey)
 *   - Allergen matches (peanuts, tree nuts, shellfish, dairy, gluten, soy, eggs, sesame)
 *   - Diabetic guardrails (net carbs > 60g or Glycemic Load > 20)
 *   - Hypertension guardrails (meal sodium > 700mg)
 *
 * Every warning display enforces the mandatory clinical safety disclaimer:
 * "⚠️ Nutritional analysis is informational and not a substitute for clinical advice."
 */

import type { DetectedItem, NutritionFacts, UserProfile } from '../types/schemas';
import { getEffectiveNutrition } from './personalize';

export type ConflictType =
  | 'halal'
  | 'vegetarian'
  | 'vegan'
  | 'allergen'
  | 'diabetic'
  | 'hypertension'
  | 'clinical';

export type ConflictSeverity = 'critical' | 'warning' | 'info';

export interface DietConflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  title_en: string;
  title_bn: string;
  detail_en: string;
  detail_bn: string;
  offending_items: string[];
  recommendation_en?: string;
  recommendation_bn?: string;
}

export const CLINICAL_DISCLAIMER_EN =
  '⚠️ Nutritional analysis is informational and not a substitute for clinical advice. Consult your physician for medical decisions.';

export const CLINICAL_DISCLAIMER_BN =
  '⚠️ পুষ্টিগত বিশ্লেষণ তথ্যমূলক এবং চিকিৎসকের বিকল্প নয়। চিকিৎসাগত পরামর্শের জন্য আপনার ডাক্তারের পরামর্শ নিন।';

// ── Item Word Matching Helper ──────────────────────────────────────────────

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => {
    const kwLower = kw.toLowerCase();
    // Match word boundaries or substring if multi-word
    return lower.includes(kwLower);
  });
}

// ── Ingredients & Allergen Dictionaries ────────────────────────────────────

const NON_HALAL_KEYWORDS = [
  'pork',
  'bacon',
  'ham',
  'lard',
  'prosciutto',
  'pancetta',
  'pork sausage',
  'pork chop',
  'pepperoni',
  'gelatin',
  'beer',
  'wine',
  'rum',
  'alcohol',
  'vodka',
  'whiskey',
  'কোরক',
  'পর্ক',
  'বেকন',
  'হ্যাম',
  'মদ',
  'ওয়াইন',
];

const MEAT_SEAFOOD_KEYWORDS = [
  'beef',
  'chicken',
  'mutton',
  'lamb',
  'pork',
  'bacon',
  'ham',
  'steak',
  'fish',
  'salmon',
  'tuna',
  'shrimp',
  'prawn',
  'crab',
  'lobster',
  'meat',
  'poultry',
  'duck',
  'turkey',
  'ilish',
  'rui',
  'chingri',
  'katla',
  'kebab',
  'biryani',
  'মাংস',
  'গরু',
  'মুরগি',
  'খাসি',
  'মাছ',
  'চিংড়ি',
  'ইলিশ',
  'রুই',
  'কাবাব',
];

const DAIRY_EGG_KEYWORDS = [
  'milk',
  'cheese',
  'butter',
  'ghee',
  'yogurt',
  'curd',
  'cream',
  'paneer',
  'egg',
  'eggs',
  'omelette',
  'honey',
  'দুধ',
  'পনির',
  'মাখন',
  'ঘি',
  'দই',
  'ডিম',
  'অমলেট',
  'মধু',
];

const ALLERGEN_KEYWORD_MAP: Record<string, string[]> = {
  Peanuts: ['peanut', 'peanuts', 'peanut butter', 'চীনাবাদাম', 'বাদাম'],
  'Tree nuts': [
    'almond',
    'cashew',
    'walnut',
    'pistachio',
    'hazelnut',
    'pecan',
    'কাঠবাদাম',
    'কাজুবাদাম',
    'পেস্তাবাদাম',
    'আখরোট',
  ],
  Shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel', 'চিংড়ি', 'কাঁকড়া'],
  'Shell shellfish': ['shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel', 'চিংড়ি', 'কাঁকড়া'],
  Dairy: ['milk', 'cheese', 'butter', 'ghee', 'yogurt', 'curd', 'cream', 'paneer', 'দুধ', 'পনির', 'মাখন', 'ঘি', 'দই'],
  Gluten: ['wheat', 'bread', 'roti', 'paratha', 'pasta', 'atta', 'maida', 'flour', 'বার্লি', 'গম', 'আটা', 'ময়দা', 'রুটি', 'পরোটা', 'পাউরুটি'],
  Soy: ['soy', 'soya', 'tofu', 'edamame', 'soy sauce', 'সয়াবিন', 'টোফু'],
  Eggs: ['egg', 'eggs', 'omelette', 'dim', 'ডিম', 'ডিম ভাজি', 'অমলেট'],
  Sesame: ['sesame', 'tahini', 'তিল', 'তিলের খাজা'],
};

/**
 * Pure evaluation function that scans the meal against the active profile.
 */
export function checkDietConflicts(
  detected: DetectedItem[],
  profile: UserProfile,
  resolvedFactsMap?: Record<string, NutritionFacts>,
): DietConflict[] {
  const conflicts: DietConflict[] = [];
  if (!detected || detected.length === 0) return conflicts;

  // 1. Halal check
  const isHalalUser = profile.preferences?.includes('Halal') || profile.dietType === 'halal';
  if (isHalalUser) {
    const offending = detected.filter((it) =>
      matchesKeywords(it.name + ' ' + (it.name_bn || ''), NON_HALAL_KEYWORDS),
    );
    if (offending.length > 0) {
      conflicts.push({
        id: 'conflict-halal',
        type: 'halal',
        severity: 'critical',
        title_en: 'Halal Restriction Violation',
        title_bn: 'হারাম বা নিষিদ্ধ উপাদান সতর্কতা',
        detail_en: `Detected non-Halal items: ${offending.map((i) => i.name).join(', ')}. Not permissible under Halal dietary guidelines.`,
        detail_bn: `হারাম/নিষিদ্ধ উপাদান শনাক্ত হয়েছে: ${offending.map((i) => i.name_bn || i.name).join(', ')}। হালাল খাদ্যাভ্যাস অনুযায়ী এটি বর্জনীয়।`,
        offending_items: offending.map((i) => i.name),
        recommendation_en: 'Substitute with certified Halal beef, chicken, mutton, or plant-based proteins.',
        recommendation_bn: 'হালাল সার্টিফাইড মাংস বা উদ্ভিদজাত প্রোটিন দিয়ে প্রতিস্থাপন করুন।',
      });
    }
  }

  // 2. Vegetarian & Vegan check
  const isVegetarianUser =
    profile.preferences?.includes('Vegetarian') || profile.dietType === 'vegetarian';
  const isVeganUser =
    profile.preferences?.includes('Vegan') || profile.dietType === 'vegan';

  if (isVegetarianUser || isVeganUser) {
    const meatOffenders = detected.filter((it) =>
      matchesKeywords(it.name + ' ' + (it.name_bn || ''), MEAT_SEAFOOD_KEYWORDS),
    );
    if (meatOffenders.length > 0) {
      conflicts.push({
        id: 'conflict-vegetarian',
        type: 'vegetarian',
        severity: 'critical',
        title_en: 'Vegetarian Dietary Conflict',
        title_bn: 'নিরামিষ খাদ্যাভ্যাস সতর্কতা',
        detail_en: `Contains meat or seafood: ${meatOffenders.map((i) => i.name).join(', ')}.`,
        detail_bn: `আমিষ/মাংস বা মাছ জাতীয় উপাদান শনাক্ত হয়েছে: ${meatOffenders.map((i) => i.name_bn || i.name).join(', ')}।`,
        offending_items: meatOffenders.map((i) => i.name),
        recommendation_en: 'Swap with lentils (dal), chickpeas (chola), tofu, or mixed vegetable curries.',
        recommendation_bn: 'মুসুর বা মুগ ডাল, ছোলা, পনির বা সবজি তরকারি দিয়ে প্রতিস্থাপন করুন।',
      });
    }

    if (isVeganUser) {
      const dairyOffenders = detected.filter((it) =>
        matchesKeywords(it.name + ' ' + (it.name_bn || ''), DAIRY_EGG_KEYWORDS),
      );
      if (dairyOffenders.length > 0) {
        conflicts.push({
          id: 'conflict-vegan',
          type: 'vegan',
          severity: 'critical',
          title_en: 'Vegan Dietary Conflict',
          title_bn: 'ভেগান খাদ্যাভ্যাস সতর্কতা',
          detail_en: `Contains animal-derived ingredients: ${dairyOffenders.map((i) => i.name).join(', ')}.`,
          detail_bn: `প্রাণিজ উপাদান (দুধ/ডিম/ঘি) শনাক্ত হয়েছে: ${dairyOffenders.map((i) => i.name_bn || i.name).join(', ')}।`,
          offending_items: dairyOffenders.map((i) => i.name),
          recommendation_en: 'Use plant milk, mustard oil instead of ghee, and tofu instead of paneer.',
          recommendation_bn: 'ঘি এর বদলে সরিষার তেল এবং পনিরের বদলে সয়াবিন বা টোফু ব্যবহার করুন।',
        });
      }
    }
  }

  // 3. Allergen Matches
  const userAllergens = profile.allergens || [];
  for (const allergen of userAllergens) {
    const keywords = ALLERGEN_KEYWORD_MAP[allergen];
    if (!keywords) continue;
    const matched = detected.filter((it) =>
      matchesKeywords(it.name + ' ' + (it.name_bn || ''), keywords),
    );
    if (matched.length > 0) {
      conflicts.push({
        id: `conflict-allergen-${allergen.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'allergen',
        severity: 'critical',
        title_en: `Allergen Detected: ${allergen}`,
        title_bn: `অ্যালার্জি সতর্কতা: ${allergen}`,
        detail_en: `Your profile lists an allergy to ${allergen}, and this meal contains: ${matched.map((i) => i.name).join(', ')}.`,
        detail_bn: `আপনার প্রোফাইলে ${allergen} অ্যালার্জি রয়েছে এবং এই খাবারে রয়েছে: ${matched.map((i) => i.name_bn || i.name).join(', ')}।`,
        offending_items: matched.map((i) => i.name),
        recommendation_en: 'Do not consume if you have severe reactions. Request allergen-free preparation.',
        recommendation_bn: 'তীব্র অ্যালার্জি থাকলে এই খাবার বর্জন করুন।',
      });
    }
  }

  // 4. Clinical Macro / Micro Guardrails (Diabetic & Hypertension)
  let totalCarbs = 0;
  let totalSodium = 0;
  let estimatedGL = 0;

  for (const it of detected) {
    const facts = getEffectiveNutrition(
      it.name,
      resolvedFactsMap?.[it.name.toLowerCase().trim()],
    );
    const factor = it.grams / 100;
    const itemCarbs = facts.carbs * factor;
    totalCarbs += itemCarbs;
    totalSodium += facts.sodium * factor;
    // Estimated Glycemic Load = (carbs in portion * glycemic share * 100) / 100
    estimatedGL += (itemCarbs * (facts.glycemic || 0.5));
  }

  // Diabetic Guardrail
  const isDiabetic =
    profile.goals?.diabetic ||
    profile.medicalConditions?.includes('diabetes_t2') ||
    profile.medicalConditions?.includes('prediabetes');

  if (isDiabetic && (totalCarbs > 60 || estimatedGL > 20)) {
    const highCarbItems = detected.filter((it) => {
      const facts = getEffectiveNutrition(it.name, resolvedFactsMap?.[it.name.toLowerCase().trim()]);
      return facts.carbs * (it.grams / 100) > 25;
    });

    conflicts.push({
      id: 'conflict-diabetic-glycemic',
      type: 'diabetic',
      severity: 'warning',
      title_en: 'High Glycemic Load / Diabetic Risk',
      title_bn: 'উচ্চ গ্লাইসেমিক লোড ও ডায়াবেটিস সতর্কতা',
      detail_en: `Estimated carbohydrate load is ${Math.round(totalCarbs)}g (GL ~${Math.round(estimatedGL)}), which may cause rapid blood sugar elevation.`,
      detail_bn: `খাবারে মোট কার্বোহাইড্রেট প্রায় ${Math.round(totalCarbs)} গ্রাম (গ্লাইসেমিক লোড ~${Math.round(estimatedGL)}), যা রক্তে শর্করা বাড়াতে পারে।`,
      offending_items: highCarbItems.map((i) => i.name),
      recommendation_en: 'Reduce white rice or bread portion by 50% and pair with non-starchy vegetables or dal for fiber.',
      recommendation_bn: 'ভাতের পরিমাণ অর্ধেক কমিয়ে শাকসবজি বা ডাল বাড়ান যাতে আঁশ রক্তে শর্করা শোষণ ধীর করে।',
    });
  }

  // Hypertension Guardrail
  const isHypertension = profile.medicalConditions?.includes('hypertension');
  if (isHypertension && totalSodium > 700) {
    const highSodiumItems = detected.filter((it) => {
      const facts = getEffectiveNutrition(it.name, resolvedFactsMap?.[it.name.toLowerCase().trim()]);
      return facts.sodium * (it.grams / 100) > 300;
    });

    conflicts.push({
      id: 'conflict-hypertension-sodium',
      type: 'hypertension',
      severity: 'warning',
      title_en: 'Elevated Sodium / Hypertension Alert',
      title_bn: 'উচ্চ সোডিয়াম ও রক্তচাপ সতর্কতা',
      detail_en: `Meal sodium reaches ${Math.round(totalSodium)}mg (clinical per-meal target is ~600-700mg max).`,
      detail_bn: `খাবারে সোডিয়ামের পরিমাণ প্রায় ${Math.round(totalSodium)} মিলিগ্রাম (প্রতি বেলার নিরাপদ মাত্রা ৬০০-৭০০ মিলিগ্রাম)।`,
      offending_items: highSodiumItems.map((i) => i.name),
      recommendation_en: 'Avoid added table salt, pickles (achar), and salted gravies.',
      recommendation_bn: 'কাঁচা লবণ, আচার এবং অতিরিক্ত লবণাক্ত ঝোল পরিহার করুন।',
    });
  }

  return conflicts;
}
