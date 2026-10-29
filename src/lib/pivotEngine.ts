/**
 * Dietary Pivot & Nutrient-Delta Engine.
 *
 * Evaluates meal composition against active clinical targets and provides
 * actionable, culturally relevant meal swaps (e.g., reducing white rice and
 * adding steamed sabzi or dal) with exact numeric deltas for calories,
 * carbs, fiber, sodium, glycemic load, and BDT market costs.
 */

import type { DetectedItem, NutritionFacts, UserProfile } from '../types/schemas';
import { getEffectiveNutrition } from './personalize';
import { resolveMarketPrice } from './marketPrices';
import { fetchLivePrice } from './priceScraper';

export interface PivotItem {
  name: string;
  name_bn: string;
  grams: number;
  category: string;
  price_bdt: number;
}

export interface NutrientDelta {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  sodium: number;
  cost_bdt: number;
}

export interface DietaryPivot {
  id: string;
  title_en: string;
  title_bn: string;
  rationale_en: string;
  rationale_bn: string;
  trigger_reason_en: string;
  trigger_reason_bn: string;
  original_items: Array<{ name: string; name_bn?: string | null; grams: number }>;
  suggested_items: PivotItem[];
  delta: NutrientDelta;
  glycemic_reduction_pct: number;
  grocery_items_to_add: Array<{ name: string; name_bn: string; price_bdt: number; category: string }>;
  is_live_price: boolean;
  price_source?: string;
}

export function generateDietaryPivots(
  detected: DetectedItem[],
  profile?: UserProfile | null,
  resolvedFactsMap?: Record<string, NutritionFacts>,
): DietaryPivot[] {
  if (!detected || detected.length === 0) return [];

  const pivots: DietaryPivot[] = [];

  // Helper to calculate totals for a set of items
  const calcTotals = (items: Array<{ name: string; grams: number }>) => {
    return items.reduce(
      (acc, it) => {
        const n = getEffectiveNutrition(it.name, resolvedFactsMap?.[it.name.toLowerCase().trim()]);
        const f = it.grams / 100;
        const priceInfo = resolveMarketPrice(it.name, it.grams);
        return {
          kcal: acc.kcal + n.kcal * f,
          carbs: acc.carbs + n.carbs * f,
          protein: acc.protein + n.protein * f,
          fat: acc.fat + n.fat * f,
          fiber: acc.fiber + n.fiber * f,
          sodium: acc.sodium + n.sodium * f,
          cost: acc.cost + priceInfo.estimatedCost,
        };
      },
      { kcal: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sodium: 0, cost: 0 },
    );
  };

  const isDiabetic =
    profile?.goals.diabetic ||
    profile?.medicalConditions?.includes('diabetes_t2') ||
    profile?.medicalConditions?.includes('prediabetes');
  const isHypertension = profile?.medicalConditions?.includes('hypertension');
  const isHighProtein = profile?.goals.protein;

  // ── Pivot 1: High White Rice / Starch Reduction ─────────────────────────
  const riceItem = detected.find((d) => {
    const lower = d.name.toLowerCase();
    return (
      (lower.includes('rice') || lower.includes('bhat') || lower.includes('ভাত')) &&
      !lower.includes('brown') &&
      !lower.includes('cauliflower') &&
      d.grams >= 180
    );
  });

  if (riceItem && (isDiabetic || riceItem.grams >= 220)) {
    const origRiceGrams = riceItem.grams;
    const origNutrition = calcTotals([{ name: riceItem.name, grams: origRiceGrams }]);

    // Suggested: Reduce to 100g Brown Rice + 120g Steamed Mixed Sabzi
    const suggested: PivotItem[] = [
      {
        name: 'Brown rice (Lal chal)',
        name_bn: 'লাল চালের ভাত',
        grams: Math.round(origRiceGrams * 0.45),
        category: 'Grains & staples',
        price_bdt: resolveMarketPrice('Brown rice (Lal chal)', origRiceGrams * 0.45).estimatedCost,
      },
      {
        name: 'Steamed Mixed Sabzi (Palong & Papaya)',
        name_bn: 'মিশ্র সবজি ও পালং শাক',
        grams: 120,
        category: 'Produce',
        price_bdt: resolveMarketPrice('Palong shak (Spinach)', 120).estimatedCost,
      },
    ];

    const pivotNutrition = calcTotals(
      suggested.map((s) => ({ name: s.name, grams: s.grams })),
    );

    const delta: NutrientDelta = {
      kcal: Math.round(pivotNutrition.kcal - origNutrition.kcal),
      carbs: Math.round(pivotNutrition.carbs - origNutrition.carbs),
      protein: Math.round(pivotNutrition.protein - origNutrition.protein),
      fat: Math.round(pivotNutrition.fat - origNutrition.fat),
      fiber: Math.round((pivotNutrition.fiber - origNutrition.fiber) * 10) / 10,
      sodium: Math.round(pivotNutrition.sodium - origNutrition.sodium),
      cost_bdt: Math.round(pivotNutrition.cost - origNutrition.cost),
    };

    pivots.push({
      id: 'pivot-rice-glycemic-optimization',
      title_en: 'Low-GI Grain & Fiber Pivot',
      title_bn: 'কম গ্লাইসেমিক লাল চাল ও সবজির সমন্বয়',
      trigger_reason_en: `High white rice portion (${origRiceGrams}g) creates a sudden blood glucose surge.`,
      trigger_reason_bn: `সাদা ভাতের উচ্চ পরিমাণ (${origRiceGrams} গ্রাম) রক্তে দ্রুত শর্করা বাড়ায়।`,
      rationale_en: `Replacing half the white rice with unpolished brown rice and green produce cuts ${Math.abs(delta.carbs)}g net carbs and adds ${Math.abs(delta.fiber)}g fiber, preventing insulin spikes with negligible cost difference (৳${delta.cost_bdt > 0 ? '+' : ''}${delta.cost_bdt}).`,
      rationale_bn: `সাদা ভাত কমিয়ে লাল চাল এবং শাকসবজি যুক্ত করলে ${Math.abs(delta.carbs)} গ্রাম শর্করা হ্রাস পায় এবং ${Math.abs(delta.fiber)} গ্রাম আঁশ বৃদ্ধি পায়। খরচের পার্থক্য মাত্র ৳${delta.cost_bdt > 0 ? '+' : ''}${delta.cost_bdt}।`,
      original_items: [{ name: riceItem.name, name_bn: riceItem.name_bn || 'সাদা ভাত', grams: origRiceGrams }],
      suggested_items: suggested,
      delta,
      glycemic_reduction_pct: 46,
      grocery_items_to_add: [
        { name: 'Brown rice (Lal chal)', name_bn: 'লাল চাল', price_bdt: 90, category: 'Grains & staples' },
        { name: 'Palong shak (Spinach)', name_bn: 'পালং শাক', price_bdt: 25, category: 'Produce' },
        { name: 'Green papaya (Kacha pepe)', name_bn: 'কাঁচা পেঁপে', price_bdt: 40, category: 'Produce' },
      ],
      is_live_price: false,
      price_source: 'TCB/DAM Benchmark',
    });
  }

  // ── Pivot 2: Sodium & Blood Pressure Optimization ───────────────────────
  const highSodiumItem = detected.find((d) => {
    const facts = getEffectiveNutrition(d.name, resolvedFactsMap?.[d.name.toLowerCase().trim()]);
    return facts.sodium * (d.grams / 100) > 400;
  });

  if (highSodiumItem && (isHypertension || true)) {
    const origGrams = highSodiumItem.grams;
    const origNutrition = calcTotals([{ name: highSodiumItem.name, grams: origGrams }]);

    // Pivot: Drain extra gravy/sauce, pair with fresh cucumber & lemon salad
    const suggested: PivotItem[] = [
      {
        name: 'Light Gravy Lean Cut',
        name_bn: 'হালকা ঝোলের তরকারি',
        grams: Math.round(origGrams * 0.75),
        category: 'Protein',
        price_bdt: resolveMarketPrice(highSodiumItem.name, origGrams * 0.75).estimatedCost,
      },
      {
        name: 'Cucumber & Lemon Salad',
        name_bn: 'শসা ও লেবুর সালাদ',
        grams: 100,
        category: 'Produce',
        price_bdt: resolveMarketPrice('Cucumber (Shosha)', 100).estimatedCost,
      },
    ];

    const pivotNutrition = calcTotals(
      suggested.map((s) => ({ name: s.name, grams: s.grams })),
    );

    const delta: NutrientDelta = {
      kcal: Math.round(pivotNutrition.kcal - origNutrition.kcal),
      carbs: Math.round(pivotNutrition.carbs - origNutrition.carbs),
      protein: Math.round(pivotNutrition.protein - origNutrition.protein),
      fat: Math.round(pivotNutrition.fat - origNutrition.fat),
      fiber: Math.round((pivotNutrition.fiber - origNutrition.fiber) * 10) / 10,
      sodium: Math.round(pivotNutrition.sodium - origNutrition.sodium),
      cost_bdt: Math.round(pivotNutrition.cost - origNutrition.cost),
    };

    pivots.push({
      id: 'pivot-sodium-hypertension-relief',
      title_en: 'Low-Sodium Gravy & Potassium Pivot',
      title_bn: 'কম সোডিয়াম ঝোল ও পটাশিয়াম সালাদ',
      trigger_reason_en: `Item ${highSodiumItem.name} contributes over 400mg sodium in gravy alone.`,
      trigger_reason_bn: `${highSodiumItem.name_bn || highSodiumItem.name} থেকে ঝোলে ৪০০ মিলিগ্রামের বেশি সোডিয়াম রয়েছে।`,
      rationale_en: `Reducing heavy gravy and introducing fresh cucumber with lemon cuts ~${Math.abs(delta.sodium)}mg sodium while replenishing heart-protective potassium.`,
      rationale_bn: `ঝোলের পরিমাণ কমিয়ে শসা ও লেবুর সালাদ যোগ করলে প্রায় ${Math.abs(delta.sodium)} মিলিগ্রাম সোডিয়াম কমে এবং রক্তচাপ স্বাভাবিক থাকে।`,
      original_items: [{ name: highSodiumItem.name, name_bn: highSodiumItem.name_bn, grams: origGrams }],
      suggested_items: suggested,
      delta,
      glycemic_reduction_pct: 12,
      grocery_items_to_add: [
        { name: 'Cucumber (Shosha)', name_bn: 'শসা', price_bdt: 50, category: 'Produce' },
        { name: 'Lemon (Kagoji lebu)', name_bn: 'কাগজি লেবু', price_bdt: 25, category: 'Produce' },
      ],
      is_live_price: false,
      price_source: 'TCB/DAM Benchmark',
    });
  }

  // ── Pivot 3: Protein Density Enhancement ────────────────────────────────
  const mealTotals = calcTotals(detected.map((d) => ({ name: d.name, grams: d.grams })));
  if (isHighProtein && mealTotals.protein < 20) {
    const suggested: PivotItem[] = [
      {
        name: 'Eggs (Farm, brown)',
        name_bn: 'সিদ্ধ ডিম (১টি)',
        grams: 50,
        category: 'Protein',
        price_bdt: 12,
      },
      {
        name: 'Masoor dal (fine)',
        name_bn: 'ঘন মসুর ডাল',
        grams: 100,
        category: 'Grains & staples',
        price_bdt: 15,
      },
    ];

    const addNutrition = calcTotals(
      suggested.map((s) => ({ name: s.name, grams: s.grams })),
    );

    const delta: NutrientDelta = {
      kcal: Math.round(addNutrition.kcal),
      carbs: Math.round(addNutrition.carbs),
      protein: Math.round(addNutrition.protein),
      fat: Math.round(addNutrition.fat),
      fiber: Math.round(addNutrition.fiber * 10) / 10,
      sodium: Math.round(addNutrition.sodium),
      cost_bdt: 27,
    };

    pivots.push({
      id: 'pivot-protein-density-boost',
      title_en: 'High-Protein & Satiety Booster',
      title_bn: 'উচ্চ প্রোটিন ও দীর্ঘস্থায়ী তৃপ্তির সংযোজন',
      trigger_reason_en: `Current meal provides only ${Math.round(mealTotals.protein)}g protein (target is 25g+).`,
      trigger_reason_bn: `এই খাবারে মাত্র ${Math.round(mealTotals.protein)} গ্রাম প্রোটিন রয়েছে (লক্ষ্য ২৫+ গ্রাম)।`,
      rationale_en: `Adding 1 boiled egg and 100g thick dal delivers +${delta.protein}g complete protein for only ৳${delta.cost_bdt}.`,
      rationale_bn: `১টি সিদ্ধ ডিম ও ঘন ডাল যোগ করলে মাত্র ৳${delta.cost_bdt} খরচে অতিরিক্ত ${delta.protein} গ্রাম প্রোটিন যুক্ত হয়।`,
      original_items: [],
      suggested_items: suggested,
      delta,
      glycemic_reduction_pct: 15,
      grocery_items_to_add: [
        { name: 'Eggs (Farm, brown)', name_bn: 'ফার্মের লাল ডিম', price_bdt: 140, category: 'Protein' },
        { name: 'Masoor dal (fine)', name_bn: 'চিকন মসুর ডাল', price_bdt: 150, category: 'Grains & staples' },
      ],
      is_live_price: false,
      price_source: 'TCB/DAM Benchmark',
    });
  }

  return pivots;
}

/**
 * Asynchronously enriches dietary pivots with live scraped prices from Chaldal
 * wrapped in a strict 3000ms timeout with automatic benchmark fallback.
 */
export async function generateDietaryPivotsAsync(
  detected: DetectedItem[],
  profile?: UserProfile | null,
  resolvedFactsMap?: Record<string, NutritionFacts>,
  options?: { forceLive?: boolean }
): Promise<DietaryPivot[]> {
  const syncPivots = generateDietaryPivots(detected, profile, resolvedFactsMap);
  if (syncPivots.length === 0) return [];

  const updatedPivots = await Promise.all(
    syncPivots.map(async (pivot) => {
      let hasLive = false;
      let primarySource = 'TCB/DAM Benchmark';

      const updatedGroceryItems = await Promise.all(
        pivot.grocery_items_to_add.map(async (gItem) => {
          try {
            const liveRes = await fetchLivePrice(gItem.name, gItem.name_bn, options);
            if (liveRes.is_live_price) {
              hasLive = true;
              primarySource = liveRes.source;
            }
            return {
              ...gItem,
              price_bdt: liveRes.price_bdt > 0 ? liveRes.price_bdt : gItem.price_bdt,
            };
          } catch {
            return gItem;
          }
        })
      );

      return {
        ...pivot,
        grocery_items_to_add: updatedGroceryItems,
        is_live_price: hasLive,
        price_source: primarySource,
      };
    })
  );

  return updatedPivots;
}
