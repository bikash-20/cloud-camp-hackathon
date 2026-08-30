/**
 * Design tokens + legacy re-exports.
 *
 * The "data" module previously mixed runtime mock data with design tokens.
 * Mock data now lives in `src/mocks/fixtures.ts` (typed) and the API client
 * in `src/lib/api.ts`. This file:
 *   - Re-exports the Proxy-backed `T` token object from `src/theme/tokens`
 *     (the Proxy reads through a module-level pointer that ThemeProvider
 *     swaps, so existing `T.foo` call sites react to the theme without
 *     needing to be rewritten)
 *   - Re-exports the canonical fixture exports for any caller that still
 *     imports from the legacy path (preserves backward compatibility while
 *     the migration is in flight).
 */

import type { FoodCategory } from './types/schemas';
import { T } from './theme/tokens';

export { T };

export const FONT_LINK =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap';

export const USER_NAME = 'Rafi';

/**
 * Time-of-day greeting based on the user's local clock.
 *
 *   05:00–11:59 → "Good morning"
 *   12:00–17:59 → "Good afternoon"
 *   18:00–21:59 → "Good evening"
 *   22:00–04:59 → "Hello"
 *
 * Falls back to a static greeting if the hour can't be read (SSR/edge).
 */
export function getGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  if (h >= 18 && h < 22) return 'Good evening';
  return 'Hello';
}

// ── Category tile gradients (typed) ─────────────────────────────────────

export const CATEGORY_TILES: Record<FoodCategory, string> = {
  protein:   'linear-gradient(135deg, #A8836C, #77574A)',
  produce:   'linear-gradient(135deg, #B8C68A, #7A8C4F)',
  grains:    'linear-gradient(135deg, #D0AE92, #A8836C)',
  other:     'linear-gradient(135deg, #D0AE92, #77574A)',
};

// ── Legacy re-exports (so existing component imports keep working) ──────

import {
  MOCK_DETECTED,
  MOCK_NUTRITION_DB,
  MOCK_HISTORY_SUGGESTIONS,
  MOCK_TABS,
  STEP_LABELS,
} from './mocks/fixtures';

export {
  MOCK_DETECTED,
  MOCK_NUTRITION_DB,
  MOCK_HISTORY_SUGGESTIONS,
  MOCK_TABS as TABS,
  STEP_LABELS,
};

export const INITIAL_DETECTED = MOCK_DETECTED;
export const NUTRITION_DB = MOCK_NUTRITION_DB;
export const HISTORY_SUGGESTIONS = MOCK_HISTORY_SUGGESTIONS;