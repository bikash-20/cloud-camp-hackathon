import { describe, expect, it } from 'vitest';
import { translateBengali } from '../../i18n/LanguageContext';
import { localizedItemReason } from './NutrientsScreen';

describe('localizedItemReason', () => {
  it('renders per-item nutrition explanations in Bengali with localized food names', () => {
    expect(
      localizedItemReason(
        {
          itemName: 'Rice',
          reason: 'Rice adds 600mg sodium — that is 50% of your daily cap.',
          nutrient: 'sodium',
          amount: 600,
          tone: 'warn',
          share: 0.5,
        },
        'bn',
        translateBengali,
      ),
    ).toBe('ভাত থেকে 600 মিলিগ্রাম সোডিয়াম পাওয়া যায়—এটি আপনার দৈনিক সীমার 50%।');
  });

  it('preserves the API-provided English explanation in English mode', () => {
    const reason = 'Rice adds 600mg sodium — that is 50% of your daily cap.';
    expect(
      localizedItemReason(
        {
          itemName: 'Rice',
          reason,
          nutrient: 'sodium',
          amount: 600,
          tone: 'warn',
          share: 0.5,
        },
        'en',
        translateBengali,
      ),
    ).toBe(reason);
  });
});
