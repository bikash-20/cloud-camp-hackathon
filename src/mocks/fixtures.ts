/**
 * Typed mock fixtures — single source of truth for all demo data.
 * Replaces the legacy unstructured `data.js` exports.
 */

import type {
  DetectedItem,
  FoodDescriptor,
  GroceryGroup,
  UserProfile,
  TabDescriptor,
} from '../types/schemas';

// ── Vision pipeline initial output ──────────────────────────────────────

export const MOCK_DETECTED: DetectedItem[] = [
  { name: 'Chicken biryani', confidence: 92, grams: 310, note: null },
  { name: 'Cucumber raita', confidence: 88, grams: 90, note: null },
  { name: 'Mixed salad',    confidence: 61, grams: 70, note: 'Low confidence — tap to confirm' },
  { name: 'Pickled onion',  confidence: 74, grams: 25, note: null },
];

// ── Nutrition database ──────────────────────────────────────────────────

export const MOCK_NUTRITION_DB: Record<string, FoodDescriptor> = {
  'Chicken biryani': {
    protein: 6.0, carbs: 22.0, fat: 4.5, kcal: 165,
    fiber: 0.6, sodium: 380, sugar: 0.9, glycemic: 0.71,
    emoji: '🍗', category: 'protein',
    alternatives: ['Chicken Tikka', 'Chicken Korma'],
    pairings: ['Naan', 'Mint chutney'],
  },
  'Cucumber raita': {
    protein: 2.4, carbs: 4.0, fat: 2.8, kcal: 56,
    fiber: 0.3, sodium: 60, sugar: 2.6, glycemic: 0.05,
    emoji: '🥒', category: 'produce',
    alternatives: ['Yogurt dip', 'Tzatziki'],
    pairings: ['Papad', 'Boiled egg'],
  },
  'Mixed salad': {
    protein: 1.2, carbs: 3.6, fat: 0.3, kcal: 22,
    fiber: 1.4, sodium: 18, sugar: 1.8, glycemic: 0.02,
    emoji: '🥗', category: 'produce',
    alternatives: ['Greek Salad', 'Garden Salad'],
    pairings: ['Olive oil', 'Feta cheese'],
  },
  'Pickled onion': {
    protein: 1.0, carbs: 9.0, fat: 0.1, kcal: 42,
    fiber: 1.7, sodium: 250, sugar: 4.0, glycemic: 0.03,
    emoji: '🧅', category: 'produce',
    alternatives: ['Red onion', 'Shallots'],
    pairings: ['Lemon juice', 'Sumac'],
  },
};

export const MOCK_HISTORY_SUGGESTIONS: Array<{
  name: string; emoji: string; category: 'protein' | 'produce' | 'grains' | 'other';
  confidence: number; grams: number;
}> = [
  { name: 'Naan',          emoji: '🫓', category: 'grains',  confidence: 100, grams: 60  },
  { name: 'Mint chutney',  emoji: '🌿', category: 'other',   confidence: 100, grams: 20  },
  { name: 'Boiled egg',    emoji: '🥚', category: 'protein', confidence: 100, grams: 50  },
  { name: 'Lassi',         emoji: '🥛', category: 'other',   confidence: 100, grams: 200 },
];

// ── Daily macro targets (used by NutrientsScreen) ───────────────────────

export const MOCK_TARGETS = {
  kcal: 720,
  protein: 50,
  carbs: 40,
  fat: 65,
  fiber: 30,
  sodium: 1200,
  sugar: 25,
};

// ── Profile defaults ────────────────────────────────────────────────────

export const MOCK_PROFILE: UserProfile = {
  name: 'Rafi',
  goals: { diabetic: true, protein: false, budget: true, mediter: false },
  preferences: [],
  allergens: ['Peanuts'],
  budget: 500,
  serving: 1,
};

// ── Grocery list ────────────────────────────────────────────────────────

export const MOCK_GROCERY_GROUPS: GroceryGroup[] = [
  {
    category: 'Grains & staples',
    items: [
      { id: 'g-0-0', name: 'Brown rice',     price: 90,  checked: true  },
      { id: 'g-0-1', name: 'Whole wheat atta', price: 60, checked: false },
    ],
  },
  {
    category: 'Produce',
    items: [
      { id: 'g-1-0', name: 'Cucumber',     price: 20, checked: false },
      { id: 'g-1-1', name: 'Spinach',      price: 25, checked: false },
      { id: 'g-1-2', name: 'Tomato',       price: 30, checked: false },
    ],
  },
  {
    category: 'Protein',
    items: [
      { id: 'g-2-0', name: 'Eggs (6)',         price: 75,  checked: false },
      { id: 'g-2-1', name: 'Chicken breast',   price: 140, checked: false },
    ],
  },
];

// ── Tabs (visual config only — not API-shared) ──────────────────────────

export const MOCK_TABS: TabDescriptor[] = [
  { id: 'capture',   label: 'Capture',   icon: 'Camera' },
  { id: 'results',   label: 'Results',   icon: 'ScanLine' },
  { id: 'nutrients', label: 'Nutrients', icon: 'Activity' },
  { id: 'profile',   label: 'Profile',   icon: 'User' },
  { id: 'grocery',   label: 'Grocery',   icon: 'ShoppingBag' },
];

export const STEP_LABELS = ['Review', 'Adjust', 'Confirm'] as const;
