import { describe, expect, it } from 'vitest';
import { buildContributions, mealTotals, getEffectiveNutrition, calculateBiometricsBreakdown } from './personalize';
import { MOCK_NUTRITION_DB, MOCK_TARGETS } from '../mocks/fixtures';
import type { ResolvedItem, UserProfile } from '../types/schemas';

function resolveFromMock(name: string, grams: number): ResolvedItem {
  const descriptor = MOCK_NUTRITION_DB[name] ?? null;
  return {
    name,
    confidence: 90,
    grams,
    note: null,
    nutrition: descriptor ? { ...descriptor } : null,
    descriptor,
    source: descriptor ? 'cache' : 'estimated',
    partial: descriptor == null,
  };
}

const diabeticProfile: UserProfile = {
  name: 'Test',
  goals: { diabetic: true, protein: false, budget: false, mediter: false },
  preferences: [],
  allergens: [],
  budget: 500,
  serving: 1,
};

const nonDiabeticProfile: UserProfile = {
  ...diabeticProfile,
  goals: { diabetic: false, protein: false, budget: false, mediter: false },
};

describe('mealTotals', () => {
  it('returns zeros for an empty list', () => {
    const totals = mealTotals([]);
    expect(totals.kcal).toBe(0);
    expect(totals.protein).toBe(0);
  });

  it('scales each nutrient by grams/100', () => {
    const items = [resolveFromMock('Chicken biryani', 200)];
    const totals = mealTotals(items);
    // Chicken biryani is 165 kcal/100g → 330 kcal for 200g.
    expect(totals.kcal).toBeCloseTo(330, 5);
    expect(totals.protein).toBeCloseTo(12, 5); // 6 g/100g × 2
  });

  it('skips items with no nutrition', () => {
    const items: ResolvedItem[] = [
      { name: 'Mystery', confidence: 80, grams: 100, note: null, nutrition: null, descriptor: null, source: 'estimated', partial: true },
      resolveFromMock('Chicken biryani', 100),
    ];
    const totals = mealTotals(items);
    expect(totals.kcal).toBeCloseTo(165, 5);
  });

  it('sums multiple items correctly', () => {
    const items = [
      resolveFromMock('Chicken biryani', 200),
      resolveFromMock('Mixed salad', 100),
    ];
    const totals = mealTotals(items);
    expect(totals.kcal).toBeCloseTo(330 + 22, 5);
  });
});

describe('buildContributions', () => {
  it('returns an empty list when no profile is provided', () => {
    const items = [resolveFromMock('Chicken biryani', 500)];
    const totals = mealTotals(items);
    expect(buildContributions(items, totals, null)).toEqual([]);
  });

  it('emits a sodium warn for non-diabetic + heavy-sodium meal', () => {
    // 1500g of Chicken biryani (380mg/100g) = 5700mg sodium — well over
    // the 1200mg cap. Chicken biryani owns 100% share → warn.
    const items = [resolveFromMock('Chicken biryani', 1500)];
    const totals = mealTotals(items);
    const out = buildContributions(items, totals, nonDiabeticProfile);
    const sodium = out.filter((c) => c.nutrient === 'sodium' && c.flagged);
    expect(sodium.length).toBeGreaterThan(0);
    expect(sodium[0].tone).toBe('warn');
    expect(sodium[0].itemName).toBe('Chicken biryani');
  });

  it('emits a sugar warn for diabetic + high-sugar meal', () => {
    // Build a synthetic item with very high sugar to trip the rule.
    const items: ResolvedItem[] = [
      {
        name: 'Sweet dish',
        confidence: 90,
        grams: 500,
        note: null,
        nutrition: {
          protein: 0, carbs: 60, fat: 0, kcal: 300,
          fiber: 0, sodium: 0, sugar: 60, glycemic: 0.9,
        },
        descriptor: null,
        source: 'estimated',
        partial: false,
      },
    ];
    const totals = mealTotals(items);
    // 500g × 0.6g/g = 300g sugar — over the 25g cap.
    expect(totals.sugar).toBeGreaterThan(MOCK_TARGETS.sugar);
    const out = buildContributions(items, totals, diabeticProfile);
    const sugar = out.filter((c) => c.nutrient === 'sugar' && c.flagged);
    expect(sugar.length).toBeGreaterThan(0);
    expect(sugar[0].tone).toBe('warn');
  });

  it('emits a "good" sugar verdict for diabetic + low-sugar meal', () => {
    // 100g of cucumber raita (2.6g sugar/100g) = 2.6g — well under 60% of 25g.
    const items = [resolveFromMock('Cucumber raita', 100)];
    const totals = mealTotals(items);
    expect(totals.sugar).toBeLessThan(MOCK_TARGETS.sugar * 0.6);
    const out = buildContributions(items, totals, diabeticProfile);
    const sugar = out.filter((c) => c.nutrient === 'sugar');
    expect(sugar.length).toBeGreaterThan(0);
    expect(sugar[0].tone).toBe('good');
  });

  it('skips items with share < 10%', () => {
    // 1000g of low-sodium salad + 100g of a normal item — the small
    // item's share is < 10% on most rules.
    const items = [
      resolveFromMock('Mixed salad', 1000),
      resolveFromMock('Cucumber raita', 50),
    ];
    const totals = mealTotals(items);
    const out = buildContributions(items, totals, nonDiabeticProfile);
    // Both items should not appear simultaneously for the same nutrient.
    const raitas = out.filter((c) => c.itemName === 'Cucumber raita');
    expect(raitas.length).toBe(0);
  });
});

describe('getEffectiveNutrition', () => {
  it('returns valid nutrition when provided', () => {
    const facts = { protein: 20, carbs: 10, fat: 5, kcal: 165, fiber: 2, sodium: 100, sugar: 1, glycemic: 0.2 };
    expect(getEffectiveNutrition('Any Food', facts)).toEqual(facts);
  });

  it('resolves case-insensitively from mock database', () => {
    const facts = getEffectiveNutrition('chicken biryani');
    expect(facts.kcal).toBe(165);
    expect(facts.protein).toBe(6.0);
  });

  it('estimates nutrition from culinary keywords for unseen items', () => {
    const rice = getEffectiveNutrition('Steamed Basmati Rice');
    expect(rice.kcal).toBeGreaterThan(0);
    expect(rice.carbs).toBeGreaterThan(15);

    const chicken = getEffectiveNutrition('Chicken Korma');
    expect(chicken.protein).toBeGreaterThan(15);

    const dal = getEffectiveNutrition('Red Lentil Dal');
    expect(dal.fiber).toBeGreaterThan(3);
  });
});

describe('calculateBiometricsBreakdown', () => {
  it('calculates male BMR and TDEE correctly via Mifflin-St Jeor', () => {
    // Male: 70kg, 172cm, 28y -> BMR = 10(70) + 6.25(172) - 5(28) + 5 = 700 + 1075 - 140 + 5 = 1640 kcal
    // Activity moderate (1.55) -> TDEE = 1640 * 1.55 = 2542 kcal
    const b = calculateBiometricsBreakdown({
      sex: 'male',
      weightKg: 70,
      heightCm: 172,
      age: 28,
      activityLevel: 'moderate',
      goal: 'maintain',
    });
    expect(b.bmr).toBe(1640);
    expect(b.tdee).toBe(2542);
    expect(b.recommendedKcal).toBe(2542);
  });

  it('calculates female BMR with -161 offset and enforces safety floor', () => {
    // Female: 45kg, 150cm, 35y
    // BMR = 10(45) + 6.25(150) - 5(35) - 161 = 450 + 937.5 - 175 - 161 = 1051.5 -> 1052
    // Sedentary (1.2) -> TDEE = 1052 * 1.2 = 1262
    // Lose goal -> 1262 - 550 = 712 kcal -> Clinical floor of 1200 kcal enforced!
    const b = calculateBiometricsBreakdown({
      sex: 'female',
      weightKg: 45,
      heightCm: 150,
      age: 35,
      activityLevel: 'sedentary',
      goal: 'lose',
      targetRateKgPerWeek: 0.5,
    });
    expect(b.isFloored).toBe(true);
    expect(b.recommendedKcal).toBe(1200);
  });
});

