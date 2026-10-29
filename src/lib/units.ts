/**
 * Unit conversion & anonymization utilities.
 *
 * Keeps all unit transformations (cm ↔ ft-in, kg ↔ lb) in one place
 * and guarantees PII (names, exact identifiers) is stripped before
 * prompt generation for LLMs.
 */

import type { UserProfile } from '../types/schemas';

// ── Unit Conversions ────────────────────────────────────────────────────

export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  if (inches === 12) {
    return { feet: feet + 1, inches: 0 };
  }
  return { feet: Math.max(0, feet), inches: Math.max(0, inches) };
}

export function ftInToCm(feet: number, inches: number): number {
  const totalInches = Math.max(0, feet) * 12 + Math.max(0, inches);
  return Math.round(totalInches * 2.54);
}

export function kgToLb(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function lbToKg(lb: number): number {
  return Math.round((lb / 2.20462) * 10) / 10;
}

// ── Anonymization Guard ─────────────────────────────────────────────────

export interface AnonymizedPromptContext {
  dietType?: string;
  allergies: string[];
  medicalConditions: string[];
  isDiabetic: boolean;
  isHypertensive: boolean;
}

/**
 * Extract strictly non-PII dietary and health context for vision prompts.
 * Strips user name, exact weight, exact height, contact info, and budget.
 */
export function anonymizeProfileForPrompt(
  profile?: UserProfile | null,
): AnonymizedPromptContext {
  if (!profile) {
    return {
      allergies: [],
      medicalConditions: [],
      isDiabetic: false,
      isHypertensive: false,
    };
  }

  const conditions = profile.medicalConditions ?? [];
  return {
    dietType: profile.dietType ?? undefined,
    allergies: [...(profile.allergens ?? [])],
    medicalConditions: [...conditions],
    isDiabetic:
      conditions.includes('diabetes_t1') ||
      conditions.includes('diabetes_t2') ||
      conditions.includes('prediabetes') ||
      !!profile.goals.diabetic,
    isHypertensive: conditions.includes('hypertension'),
  };
}

