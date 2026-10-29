import { describe, expect, it } from 'vitest';
import { findCanonicalFood, resolveFoodName, getContextAwarePairings } from './foodAliases';

describe('foodAliases resolver', () => {
  it('resolves authentic Bangladeshi foods in Bengali and English', () => {
    expect(resolveFoodName('Chicken Biryani', 'bn')).toBe('চিকেন বিরিয়ানি');
    expect(resolveFoodName('Chicken Biryani', 'en')).toBe('Chicken Biryani');

    expect(resolveFoodName('bhaat', 'bn')).toBe('ভাত');
    expect(resolveFoodName('white rice', 'bn')).toBe('ভাত');
    expect(resolveFoodName('bhat', 'en')).toBe('White Rice');

    expect(resolveFoodName('masoor dal', 'bn')).toBe('মসুর ডাল');
    expect(resolveFoodName('red lentil dal', 'bn')).toBe('মসুর ডাল');

    expect(resolveFoodName('aloo bhorta', 'bn')).toBe('আলু ভর্তা');
    expect(resolveFoodName('ilish macher jhol', 'bn')).toBe('ইলিশ মাছের ঝোল');
  });

  it('handles fuzzy matching and transliteration variants', () => {
    const rice = findCanonicalFood('steamed white rice');
    expect(rice).not.toBeNull();
    expect(rice?.id).toBe('white-rice');
    expect(rice?.sodiumMgPer100g).toBe(2.0); // Never 600mg!
    expect(rice?.kcalPer100g).toBe(130.0);

    const dal = findCanonicalFood('lentil soup');
    expect(dal).not.toBeNull();

    const paratha = findCanonicalFood('teler porota');
    expect(paratha).not.toBeNull();
    expect(paratha?.id).toBe('paratha');
  });

  it('provides context-aware pairings based on detected dishes', () => {
    // When white rice is detected, it should suggest Dal, Alu Bhorta, Fish Curry
    const ricePairings = getContextAwarePairings([{ name: 'White Rice' }], 3);
    expect(ricePairings.length).toBeGreaterThanOrEqual(1);
    const pairingNames = ricePairings.map((p) => p.name);
    expect(pairingNames.some((n) => n.includes('Dal') || n.includes('Bhorta') || n.includes('Jhol') || n.includes('Dim'))).toBe(true);

    // When Biryani is detected, it should suggest Borhani, Cucumber Salad, or Kebab
    const biryaniPairings = getContextAwarePairings([{ name: 'Chicken Biryani' }], 3);
    const biryaniNames = biryaniPairings.map((p) => p.name);
    expect(biryaniNames.some((n) => n.includes('Borhani') || n.includes('Salad') || n.includes('Kebab') || n.includes('Raita'))).toBe(true);
  });
});

