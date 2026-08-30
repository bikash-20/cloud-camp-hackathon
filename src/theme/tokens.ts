/**
 * Design tokens — light and dark variants.
 *
 * The 12 keys used by every themed component are present in both objects
 * with identical names so consumers can swap `T` → `darkTokens` via the
 * ThemeProvider without touching call sites.
 *
 * The dark variant is a "warm earth" dim — same browns/ambers as light,
 * just at low lightness instead of high. Brand identity carries through;
 * no pure-black backgrounds, no cold grays.
 */

export interface TokenShape {
  // Earth palette
  earth1: string;
  earth2: string;
  earth3: string;
  earth4: string;
  earth5: string;
  earth6: string;

  // Brand
  primary: string;
  primaryLight: string;
  primaryDeep: string;

  // Surfaces
  cardBg: string;
  cardBorder: string;
  cardBorderSoft: string;

  // Text
  ink: string;
  inkSoft: string;
  inkMuted: string;

  // Status accents
  accentWarn: string;
  accentAmber: string;
  accentGood: string;

  // Legacy aliases (kept identical so older call sites keep working)
  surface: string;
  surface2: string;
  delight: string;
  warning: string;
  good: string;
  accent: string;
  accentDeep: string;
  bg: string;

  // Background gradient (used by .sage-bg)
  gradientStart: string;
  gradientMid: string;
  gradientEnd: string;
}

export const lightTokens: TokenShape = {
  earth1: '#4A3A34',
  earth2: '#77574A',
  earth3: '#A8836C',
  earth4: '#D0AE92',
  earth5: '#EBD7BE',
  earth6: '#F9F2E4',

  primary:        '#4A3A34',
  primaryLight:   '#77574A',
  primaryDeep:    '#2E2522',

  cardBg:        'rgba(249, 242, 228, 0.78)',
  cardBorder:    'rgba(74, 58, 52, 0.22)',
  cardBorderSoft:'rgba(74, 58, 52, 0.12)',

  ink:            '#2E2522',
  inkSoft:        '#77574A',
  inkMuted:       '#A8836C',

  accentWarn:     '#C9622D',
  accentAmber:    '#B8743A',
  accentGood:     '#7A8C4F',

  surface:        '#F9F2E4',
  surface2:       '#D0AE92',
  delight:        '#B8743A',
  warning:        '#C9622D',
  good:           '#7A8C4F',
  accent:         '#4A3A34',
  accentDeep:     '#2E2522',
  bg:             '#D0AE92',

  gradientStart:  '#77574A',
  gradientMid:    '#D0AE92',
  gradientEnd:    '#F9F2E4',
} as const;

/**
 * Dark variant — warm earth at low lightness.
 *
 *   Text inverted to cream, card surfaces dim to deep brown glass,
 *   brand primary becomes amber so it pops on dark backgrounds.
 *   Status accents lighten so they remain readable (warn, amber, good).
 *   Page bg matches the existing admin dashboard gradient so the two
 *   dark surfaces feel like one product.
 */
export const darkTokens: TokenShape = {
  earth1: '#1F1815',
  earth2: '#2A201B',
  earth3: '#3D302A',
  earth4: '#5C4838',
  earth5: '#7A6450',
  earth6: '#1F1815',

  primary:        '#D0AE92',
  primaryLight:   '#E8C49A',
  primaryDeep:    '#EBD7BE',

  cardBg:        'rgba(40, 30, 24, 0.78)',
  cardBorder:    'rgba(208, 174, 146, 0.18)',
  cardBorderSoft:'rgba(208, 174, 146, 0.10)',

  ink:            '#F2E8D5',
  inkSoft:        '#D0AE92',
  inkMuted:       '#8A7461',

  accentWarn:     '#F0B79A',
  accentAmber:    '#E8C49A',
  accentGood:     '#B8C68A',

  surface:        '#1F1815',
  surface2:       '#3D302A',
  delight:        '#E8C49A',
  warning:        '#F0B79A',
  good:           '#B8C68A',
  accent:         '#D0AE92',
  accentDeep:     '#EBD7BE',
  bg:             '#1B1411',

  gradientStart:  '#1B1411',
  gradientMid:    '#2A201B',
  gradientEnd:    '#1F1815',
} as const;