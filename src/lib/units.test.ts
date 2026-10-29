import { describe, it, expect } from 'vitest';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg, anonymizeProfileForPrompt } from './units';
import type { UserProfile } from '../types/schemas';

describe('Unit Conversions', () => {
  it('converts cm to feet and inches accurately', () => {
    // 175 cm is ~5 feet 9 inches
    const result = cmToFtIn(175);
    expect(result.feet).toBe(5);
    expect(result.inches).toBe(9);
  });

  it('converts feet and inches back to cm', () => {
    const cm = ftInToCm(5, 9);
    expect(cm).toBe(175);
  });

  it('converts kg to lb and back', () => {
    const lb = kgToLb(70);
    expect(lb).toBe(154.3);
    const kg = lbToKg(lb);
    expect(kg).toBe(70);
  });
});

describe('Anonymization Guard', () => {
  it('strips PII (name, weight, height, budget) from prompt context', () => {
    const profile: UserProfile = {
      name: 'Rafi Talukder',
      age: 32,
      sex: 'male',
      weightKg: 78,
      heightCm: 176,
      budget: 1500,
      serving: 2,
      dietType: 'halal',
      allergens: ['Peanuts'],
      medicalConditions: ['diabetes_t2', 'hypertension'],
      goals: { diabetic: true, protein: false, budget: false, mediter: false },
      preferences: [],
    };

    const anonymized = anonymizeProfileForPrompt(profile);
    // Explicitly verify no PII fields leak
    expect('name' in anonymized).toBe(false);
    expect('weightKg' in anonymized).toBe(false);
    expect('heightCm' in anonymized).toBe(false);
    expect('budget' in anonymized).toBe(false);

    // Verify allowed context is preserved
    expect(anonymized.dietType).toBe('halal');
    expect(anonymized.allergies).toContain('Peanuts');
    expect(anonymized.isDiabetic).toBe(true);
    expect(anonymized.isHypertensive).toBe(true);
  });
});
