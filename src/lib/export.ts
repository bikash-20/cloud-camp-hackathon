/**
 * Meal History CSV & Data Export Utility.
 *
 * Provides typed, clean export of logged meals and nutritional progress.
 */

import type { MealEntry } from '../types/schemas';

export function generateMealHistoryCSV(meals: MealEntry[]): string {
  const headers = [
    'Meal ID',
    'Date & Time',
    'Meal Label',
    'Calories (kcal)',
    'Protein (g)',
    'Carbohydrates (g)',
    'Fat (g)',
    'Fiber (g)',
    'Sodium (mg)',
    'Sugar (g)',
    'Detected Items',
  ];

  const rows = meals.map((m) => {
    const itemsList = m.items
      .map((it) => `${it.name} (${Math.round(it.grams)}g)`)
      .join('; ');

    return [
      m.id,
      m.date,
      `"${m.label.replace(/"/g, '""')}"`,
      Math.round(m.totals.kcal),
      Math.round(m.totals.protein),
      Math.round(m.totals.carbs),
      Math.round(m.totals.fat),
      Math.round(m.totals.fiber),
      Math.round(m.totals.sodium),
      Math.round(m.totals.sugar),
      `"${itemsList.replace(/"/g, '""')}"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

