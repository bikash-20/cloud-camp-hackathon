import { describe, expect, it } from 'vitest';
import { formatRelative, hashStr, pickThumbnailStyle } from './format';

describe('formatRelative', () => {
  const now = new Date('2026-10-18T15:00:00Z');

  it('returns "just now" for under a minute', () => {
    const then = new Date(now.getTime() - 30_000).toISOString();
    expect(formatRelative(then, now)).toBe('just now');
  });

  it('returns "Nm ago" for under an hour', () => {
    const then = new Date(now.getTime() - 5 * 60_000).toISOString();
    expect(formatRelative(then, now)).toBe('5m ago');
  });

  it('returns "Nh ago" for the same calendar day', () => {
    const then = new Date(now.getTime() - 3 * 60 * 60_000).toISOString();
    expect(formatRelative(then, now)).toBe('3h ago');
  });

  it('returns "Yesterday" for exactly 1 day ago', () => {
    const then = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
    expect(formatRelative(then, now)).toBe('Yesterday');
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
