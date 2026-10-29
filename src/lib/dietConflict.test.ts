import { describe, it, expect } from 'vitest';
import { checkDietConflicts, CLINICAL_DISCLAIMER_BN, CLINICAL_DISCLAIMER_EN } from './dietConflict';
import type { DetectedItem, UserProfile } from '../types/schemas';

const BASE_PROFILE: UserProfile = {
  name: 'Test User',
  age: 30,
  sex: 'male',
  heightCm: 175,
  weightKg: 70,
  activityLevel: 'moderate',
  goals: { diabetic: false, protein: false, budget: false, mediter: false },
  preferences: ['Halal'],
  allergens: ['Peanuts'],
  dietType: 'halal',
  medicalConditions: [],
  mealsPerDay: 3,
  budget: 500,
  serving: 1,
  language: 'bn',
  dailyKcalTarget: 2200,
};

describe('Diet Conflict & Clinical Warning Engine', () => {
  it('detects Halal violations when pork or bacon is detected for a Halal profile', () => {
    const detected: DetectedItem[] = [
      { name: 'Crispy Bacon', confidence: 95, grams: 80 },
      { name: 'Scrambled Eggs', confidence: 90, grams: 120 },
    ];
    const conflicts = checkDietConflicts(detected, BASE_PROFILE);
    const halalConflict = conflicts.find((c) => c.type === 'halal');

    expect(halalConflict).toBeDefined();
    expect(halalConflict?.severity).toBe('critical');
    expect(halalConflict?.offending_items).toContain('Crispy Bacon');
    expect(halalConflict?.detail_bn).toContain('হারাম/নিষিদ্ধ');
  });

  it('detects Vegetarian violations when meat or fish is detected', () => {
    const vegProfile: UserProfile = {
      ...BASE_PROFILE,
      preferences: ['Vegetarian'],
      dietType: 'vegetarian',
    };
    const detected: DetectedItem[] = [
      { name: 'Chicken Curry', name_bn: 'মুরগির তরকারি', confidence: 92, grams: 200 },
      { name: 'Steamed Rice', name_bn: 'ভাত', confidence: 98, grams: 200 },
    ];
    const conflicts = checkDietConflicts(detected, vegProfile);
    const vegConflict = conflicts.find((c) => c.type === 'vegetarian');

    expect(vegConflict).toBeDefined();
    expect(vegConflict?.severity).toBe('critical');
    expect(vegConflict?.offending_items).toContain('Chicken Curry');
  });

  it('detects Allergen matches when user has an allergen to peanuts', () => {
    const detected: DetectedItem[] = [
      { name: 'Peanut Butter Toast', confidence: 90, grams: 100 },
    ];
    const conflicts = checkDietConflicts(detected, BASE_PROFILE);
    const allergenConflict = conflicts.find((c) => c.type === 'allergen');

    expect(allergenConflict).toBeDefined();
    expect(allergenConflict?.severity).toBe('critical');
    expect(allergenConflict?.offending_items).toContain('Peanut Butter Toast');
  });

  it('detects Diabetic high glycemic load when carbs exceed threshold for diabetic user', () => {
    const diabeticProfile: UserProfile = {
      ...BASE_PROFILE,
      goals: { ...BASE_PROFILE.goals, diabetic: true },
      medicalConditions: ['diabetes_t2'],
    };
    // 350g rice = ~98g carbs -> triggers high glycemic alert
    const detected: DetectedItem[] = [
      { name: 'White Rice', name_bn: 'ভাত', confidence: 95, grams: 350 },
    ];
    const conflicts = checkDietConflicts(detected, diabeticProfile);
    const diabeticConflict = conflicts.find((c) => c.type === 'diabetic');

    expect(diabeticConflict).toBeDefined();
    expect(diabeticConflict?.severity).toBe('warning');
    expect(diabeticConflict?.title_bn).toContain('ডায়াবেটিস');
  });

  it('detects Hypertension alert when sodium exceeds 700mg for hypertensive profile', () => {
    const hyperProfile: UserProfile = {
      ...BASE_PROFILE,
      medicalConditions: ['hypertension'],
    };
    // Custom facts with high sodium
    const factsMap = {
      'salted pickle': {
        protein: 1,
        carbs: 5,
        fat: 1,
        kcal: 35,
        fiber: 2,
        sodium: 1200,
        sugar: 2,
        glycemic: 0.1,
      },
    };
    const detected: DetectedItem[] = [
      { name: 'Salted Pickle', confidence: 90, grams: 100 },
    ];
    const conflicts = checkDietConflicts(detected, hyperProfile, factsMap);
    const hyperConflict = conflicts.find((c) => c.type === 'hypertension');

    expect(hyperConflict).toBeDefined();
    expect(hyperConflict?.severity).toBe('warning');
    expect(hyperConflict?.detail_en).toContain('Meal sodium reaches');
  });

  it('verifies clinical disclaimers are present', () => {
    expect(CLINICAL_DISCLAIMER_EN).toContain('informational and not a substitute for clinical advice');
    expect(CLINICAL_DISCLAIMER_BN).toContain('পুষ্টিগত বিশ্লেষণ তথ্যমূলক এবং চিকিৎসকের বিকল্প নয়');
  });
});
