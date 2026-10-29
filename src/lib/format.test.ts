import { describe, expect, it } from 'vitest';
import { formatRelative, hashStr, pickThumbnailStyle, toBengaliDigits } from './format';

describe('toBengaliDigits', () => {
  it('converts ASCII digits to Bengali digits', () => {
    expect(toBengaliDigits(0)).toBe('০');
    expect(toBengaliDigits(1234567890)).toBe('১২৩৪৫৬৭৮৯০');
    expect(toBengaliDigits('1640 kcal')).toBe('১৬৪০ kcal');
    expect(toBengaliDigits('70.5')).toBe('৭০.৫');
  });

  it('handles null and undefined', () => {
    expect(toBengaliDigits(null)).toBe('');
    expect(toBengaliDigits(undefined)).toBe('');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-10-18T15:00:00Z');

  it('returns "just now" for under a minute in EN and BN', () => {
    const then = new Date(now.getTime() - 30_000).toISOString();
    expect(formatRelative(then, now)).toBe('just now');
    expect(formatRelative(then, now, 'bn')).toBe('এইমাত্র');
  });

  it('returns "Nm ago" for under an hour in EN and BN', () => {
    const then = new Date(now.getTime() - 5 * 60_000).toISOString();
    expect(formatRelative(then, now)).toBe('5m ago');
    expect(formatRelative(then, now, 'bn')).toBe('৫ মিনিট আগে');
  });

  it('returns "Nh ago" for the same calendar day in EN and BN', () => {
    const then = new Date(now.getTime() - 3 * 60 * 60_000).toISOString();
    expect(formatRelative(then, now)).toBe('3h ago');
    expect(formatRelative(then, now, 'bn')).toBe('৩ ঘণ্টা আগে');
  });

  it('returns "Yesterday" for exactly 1 day ago in EN and BN', () => {
    const then = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
    expect(formatRelative(then, now)).toBe('Yesterday');
    expect(formatRelative(then, now, 'bn')).toBe('গতকাল');
  });

  it('returns weekday for 2–6 days ago', () => {
    const then = new Date(now.getTime() - 3 * 24 * 60 * 60_000).toISOString();
    const result = formatRelative(then, now);
    // Should be a 3-letter weekday abbreviation — not a date.
    expect(result).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
  });

  it('returns "Mon DD" for a week or more ago', () => {
    const then = new Date(now.getTime() - 14 * 24 * 60 * 60_000).toISOString();
    const result = formatRelative(then, now);
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });
});

describe('hashStr', () => {
  it('is deterministic', () => {
    expect(hashStr('meal-abc')).toBe(hashStr('meal-abc'));
  });

  it('returns non-negative integers', () => {
    for (const s of ['a', 'biryani', 'longer-meal-id-here', '🍗']) {
      const h = hashStr(s);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(h)).toBe(true);
    }
  });

  it('produces different values for similar inputs', () => {
    // No false-positive collisions on closely-related strings.
    expect(hashStr('meal-1')).not.toBe(hashStr('meal-2'));
  });
});

describe('pickThumbnailStyle', () => {
  it('returns a palette gradient and a fallback emoji when no descriptors match', () => {
    const style = pickThumbnailStyle(
      { id: 'meal-1', items: [{ name: 'Mystery food' }] },
      {},
    );
    expect(style.bg).toMatch(/linear-gradient/);
    expect(style.emoji).toBe('🍽');
  });

  it('uses the descriptor emoji for the first item when present', () => {
    const style = pickThumbnailStyle(
      { id: 'meal-2', items: [{ name: 'Chicken biryani' }] },
      { 'Chicken biryani': '🍗' },
    );
    expect(style.emoji).toBe('🍗');
  });

  it('is deterministic for the same meal id', () => {
    const a = pickThumbnailStyle({ id: 'meal-99', items: [] }, {});
    const b = pickThumbnailStyle({ id: 'meal-99', items: [] }, {});
    expect(a).toEqual(b);
  });
});
