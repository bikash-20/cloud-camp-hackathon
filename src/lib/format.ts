/**
 * Pure formatting + hashing helpers.
 *
 * Extracted from `CaptureScreen.tsx` so other surfaces (ResultsScreen,
 * GroceryScreen) can reuse them. None of these touch React state or
 * framer-motion, so they're tree-shakeable and unit-testable in plain
 * Node (see `format.test.ts`).
 */

/** Format an ISO timestamp as a short relative string for the recent-meals
 *  list. We deliberately drop absolute time for the most-recent entries and
 *  fall back to "Yesterday" / weekday for older ones — phone-first UX, not a
 *  desktop dashboard.
 *
 *    < 1 min   → "just now"
 *    < 60 min  → "Nm ago"
 *    same day  → "Nh ago"
 *    −1 day    → "Yesterday"
 *    < 7 d     → weekday short
 *    else      → "Mon DD"
 *
 *  The "Nh ago" branch only fires when `then` and `now` land on the same
 *  calendar day — otherwise a meal logged at 23:00 yesterday and viewed at
 *  13:00 today (diffH = 14, dayDiff = 1) would incorrectly say "14h ago"
 *  instead of "Yesterday".
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (then.toDateString() === now.toDateString()) {
    const diffH = Math.floor(diffMin / 60);
    return `${diffH}h ago`;
  }
  const dayDiff = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return then.toLocaleDateString([], { weekday: 'short' });
  return then.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Hash a string into a stable non-negative 31-bit integer. Used to
 *  deterministically pick a gradient stop pair for meals that don't have
 *  a captured photo. djb2-ish; not cryptographic. */
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Pick a deterministic gradient + emoji fallback for a meal thumbnail
 *  when there's no captured image. Tied to the meal.id so the same meal
 *  always renders the same swatch — important so the list feels stable
 *  across re-renders. The emoji is the descriptor's emoji for the first
 *  item that has one; falls back to a fork-and-knife glyph. */
export function pickThumbnailStyle(
  meal: { id: string; items: Array<{ name: string }> },
  descriptorEmojis: Record<string, string>,
): { bg: string; emoji: string } {
  const palettes = [
    'linear-gradient(135deg, #D0AE92, #A8836C)',
    'linear-gradient(135deg, #B8C68A, #7A8C4F)',
    'linear-gradient(135deg, #EBD7BE, #C9622D)',
    'linear-gradient(135deg, #A8836C, #77574A)',
  ];
  const h = hashStr(meal.id);
  const bg = palettes[h % palettes.length];
  const firstItem = meal.items[0];
  const emoji = (firstItem && descriptorEmojis[firstItem.name]) || '🍽';
  return { bg, emoji };
}
