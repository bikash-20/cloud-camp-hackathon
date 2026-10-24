import { describe, expect, it } from 'vitest';
import { translateBengali } from './LanguageContext';

describe('translateBengali', () => {
  it('translates food names without depending on English capitalization', () => {
    expect(translateBengali('khichuri with egg')).toBe('ডিম দিয়ে খিচুড়ি');
  });

  it('translates complete phrases but preserves matching text inside other words', () => {
    expect(translateBengali('Other foods are another option.')).toBe(
      'অন্যান্য foods are another option.',
    );
  });

  it('translates labels embedded in accessible and sentence text', () => {
    expect(translateBengali('Search foods')).toBe('খাবার খুঁজুন');
  });

  it('translates profile controls and mixed dynamic hints', () => {
    expect(translateBengali('Toggle High-protein goal')).toBe(
      'পরিবর্তন করুন উচ্চ প্রোটিন লক্ষ্য',
    );
    expect(
      translateBengali(
        'per day — the Grocery screen applies this as a weekly cap of ৳3500 (×7 days)',
      ),
    ).toBe('প্রতিদিন—বাজারের পর্দায় এটি সাপ্তাহিক সীমা হিসেবে প্রয়োগ হয়: ৳3500 (×7 দিন)');
  });

  it('translates the nutrition explanation headings', () => {
    expect(translateBengali('This meal, explained')).toBe('এই খাবারের পুষ্টি বিশ্লেষণ');
    expect(translateBengali('Micronutrients')).toBe('অণুপুষ্টি');
  });
});
