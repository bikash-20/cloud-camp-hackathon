# NutriVision AI

> *Snap a meal. Know your body. Shop smart.*

A phone-first PWA that uses AI vision to identify foods, resolve nutrition data, personalize health flags, and generate budget-aware grocery lists.

Built for **Cloud Camp Hackathon** by [bikash-20](https://github.com/bikash-20).

## Live Demo

[https://cloud-camp-hackathon.vercel.app](https://cloud-camp-hackathon.vercel.app)

## Features

### Capture
- Real camera integration via `getUserMedia` (rear camera preferred)
- File upload fallback for devices without camera access
- Live preview with viewfinder overlay and shutter animation

### Results & Review
- Dual vision pipeline output (Gemini + HuggingFace validator)
- Confidence scores with color-coded badges (high/medium/low)
- Sortable food items (by confidence, calories, name, portion size)
- Portion editing with +/- 25g controls
- Edit mode: rename, replace with alternatives, delete items
- Bulk actions: confirm all, review low-confidence, add custom
- "Frequently eaten with" suggestions
- Glycemic index chips for diabetic profiles
- Share detected items to clipboard

### Nutrients & Analysis
- Animated macro donut charts (protein, carbs, fat)
- Visual progress bars for fiber, sodium, sugar
- SHAP-style explainability strip with per-item contributions
- Color-coded health flags (green within range, red exceeded)
- Smart insights: "Why these flags?" with item-specific verdicts
- Meal context: photo thumbnail, date/time, total calories
- Share nutrition summary to clipboard

### Profile
- Editable health goals: prediabetic-friendly, high-protein, budget-aware, Mediterranean
- Dietary preferences: Vegetarian, Vegan, Pescatarian, Gluten-free, Dairy-free, Halal, Kosher
- Allergen tracking: Peanuts, Tree nuts, Shellfish, Soy, Eggs, Dairy, Gluten, Sesame
- Daily grocery budget stepper (scales to weekly cap)
- Serving size adjustment
- User statistics: total meals logged, days active, avg kcal/day

### Grocery
- Weekly grocery list with category grouping (Grains, Produce, Protein)
- Check items as bought with strike-through
- Inline price editing (BDT currency)
- Add custom items with name + price
- "Generate from Meals" — auto-adds pairings from meal history
- Clear all items with confirmation
- Budget tracking ring with remaining balance
- Share list to clipboard

### Data Persistence
- localStorage save/load for profile, meal history, and grocery data
- Meals auto-saved after each analysis
- Today's summary card on home screen
- Recent meals section (last 3 logged)

### UX Polish
- Skeleton loaders for async data (grocery, stats, home sections)
- Empty states with helpful messages
- Toast notifications for all actions (confirm, remove, add, share)
- Error boundary with styled fallback
- Loading skeleton while profile resolves
- Back navigation from Nutrients to Results

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + Vite |
| Language | TypeScript (strict) |
| Animation | framer-motion 13 |
| Icons | lucide-react |
| PWA | Custom service worker + manifest |
| Hosting | Vercel (auto-deploy on push) |
| Styling | Inline styles + CSS tokens |

## Getting Started

### Prerequisites

- Node.js 18+
- npm (or yarn/pnpm)

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173) with hot reload.

### Type Check

```bash
npm run typecheck
```

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── main.tsx                  # React root + ErrorBoundary
├── App.tsx                   # Tab state, screen router, profile state
├── data.ts                   # Design tokens (T), greeting, re-exports
├── styles.css                # Earth-tone tokens, glass utilities, skeleton
├── types/
│   └── schemas.ts            # TypeScript contracts (mirrors backend Pydantic)
├── lib/
│   ├── api.ts                # Mock API client (drop-in swap target)
│   └── storage.ts            # Typed localStorage wrapper
├── mocks/
│   └── fixtures.ts           # Typed mock data
└── components/
    ├── PhoneFrame.tsx        # Mobile full-bleed / desktop phone mockup
    ├── BottomNav.tsx         # 5-tab dock
    ├── ErrorBoundary.tsx     # Top-level error catch
    ├── ExpandableRow.tsx     # Food item expansion with edit controls
    ├── SummaryCard.tsx       # Macro totals display
    ├── SortMenu.tsx          # Sort options dropdown
    ├── BulkActionBar.tsx     # Multi-select actions
    ├── SmartActionSheet.tsx  # Confirmation sheet
    ├── AddCustomModal.tsx    # Add custom food item
    ├── ConfidenceRing.tsx    # Animated progress ring
    ├── PhotoThumb.tsx        # Captured photo thumbnail
    ├── SectionLabel.tsx      # Section headers with actions
    ├── Chip.tsx / Pill.tsx   # Toggle components
    ├── Bar.tsx               # Progress bar
    ├── useCountUp.ts         # Animated number counter
    └── screens/
        ├── CaptureScreen.tsx     # Camera + file upload + home
        ├── ResultsScreen.tsx     # Detected items list
        ├── NutrientsScreen.tsx   # Macro donuts + explainability
        ├── ProfileScreen.tsx     # Goals, prefs, allergens, budget
        └── GroceryScreen.tsx     # Weekly grocery list
```

## Design System

- **Earth palette**: `#4A3A34` → `#F9F2E4` (warm browns to cream)
- **Glass morphism**: backdrop-filter cards with soft borders
- **Typography**: Inter (UI), Fraunces (display), IBM Plex Mono (data)
- **Motion**: spring physics via framer-motion, respects `prefers-reduced-motion`
- **Accessibility**: aria labels, focus-visible, sr-only, keyboard navigation

## Backend (Planned)

The frontend currently runs on a **mock API** (`src/lib/api.ts`) with in-memory state and simulated latency. The planned backend stack:

- **FastAPI** (Python 3.11)
- **Gemini 2.0 Flash** (primary vision) + **HuggingFace** classifier (validator)
- **Nutrition cascade**: Open Food Facts → USDA → Fruityvice
- **Cache**: SQLite (exact match) + ChromaDB (semantic image match)

To swap mocks for real endpoints, replace the function bodies in `src/lib/api.ts` with `fetch()` calls. No component changes needed.

## License

MIT
