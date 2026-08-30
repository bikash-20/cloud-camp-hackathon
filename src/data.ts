/**
 * Design tokens + legacy re-exports.
 *
 * The "data" module previously mixed runtime mock data with design tokens.
 * Mock data now lives in `src/mocks/fixtures.ts` (typed) and the API client
 * in `src/lib/api.ts`. This file:
 *   - Owns the `T` color/typography tokens (used by every component)
 *   - Re-exports the canonical fixture exports for any caller that still
 *     imports from the legacy path (preserves backward compatibility while
 *     the migration is in flight).
 */

import type { FoodCategory } from './types/schemas';

export const T = {
  // Earth palette (from the color stack)
  earth1: '#4A3A34',
  earth2: '#77574A',
  earth3: '#A8836C',
  earth4: '#D0AE92',
  earth5: '#EBD7BE',
  earth6: '#F9F2E4',

  // Background gradient
  gradientStart: '#77574A',
  gradientMid:   '#D0AE92',
  gradientEnd:   '#F9F2E4',

  // Brand
  primary:        '#4A3A34',
  primaryLight:   '#77574A',
  primaryDeep:    '#2E2522',

  // Surfaces
  cardBg:        'rgba(249, 242, 228, 0.72)',
  cardBorder:    'rgba(74, 58, 52, 0.22)',
  cardBorderSoft:'rgba(74, 58, 52, 0.12)',

  // Text
  ink:            '#2E2522',
  inkSoft:        '#77574A',
  inkMuted:       '#A8836C',

  // Status accents
  accentWarn:     '#C9622D',
  accentAmber:    '#B8743A',
  accentGood:     '#7A8C4F',

  // Legacy aliases
  surface:        '#F9F2E4',
  surface2:       '#D0AE92',
  delight:        '#B8743A',
  warning:        '#C9622D',
  good:           '#7A8C4F',
  accent:         '#4A3A34',
  accentDeep:     '#2E2522',
  bg:             '#D0AE92',
} as const;

export const FONT_LINK =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap';

export const USER_NAME = 'Rafi';

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