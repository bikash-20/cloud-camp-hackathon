import { describe, expect, it } from 'vitest';
import { generateMealHistoryCSV } from './export';
import type { MealEntry } from '../types/schemas';

describe('Meal History CSV Export', () => {
  it('generates well-formatted CSV with headers and meal entries', () => {
    const mockMeals: MealEntry[] = [
      {
        id: 'meal-001',
        date: '2026-10-29T12:00:00Z',
        label: 'Lunch: Chicken Biryani',
        items: [
          { name: 'Chicken Biryani', confidence: 95, grams: 300 },
          { name: 'Cucumber Raita', confidence: 90, grams: 100 },
        ],
        totals: {
          kcal: 750,
          protein: 42,
          carbs: 85,
          fat: 24,
          fiber: 5,
          sodium: 1250,
          sugar: 6,
        },
        activeGoals: { diabetic: true, protein: false, budget: true, mediter: false },
      },
    ];

    const csv = generateMealHistoryCSV(mockMeals);
    const lines = csv.split('\n');

    expect(lines[0]).toContain('Calories (kcal)');
    expect(lines[0]).toContain('Detected Items');
    expect(lines[1]).toContain('meal-001');
    expect(lines[1]).toContain('Lunch: Chicken Biryani');
    expect(lines[1]).toContain('Chicken Biryani (300g); Cucumber Raita (100g)');
  });
});

