# NutriVision AI

> *Snap a meal. Know your body. Shop smart.*

A phone-first PWA that uses AI vision to identify foods, resolve nutrition data, personalize health flags, and generate budget-aware grocery lists.

Built for **Cloud Camp Hackathon** by [bikash-20](https://github.com/bikash-20).

## Live Demo

[https://cloud-camp-hackathon.vercel.app](https://cloud-camp-hackathon.vercel.app)

## Features

### Capture & Home
- Real camera integration via `getUserMedia` (rear camera preferred)
- File upload fallback for devices without camera access
- Live preview with viewfinder overlay, shutter animation, and retake
- **FinTech Spline Curve Chart (`RevenueCurveChart.tsx`):** Catmull-Rom smoothed area curve showing daily calorie intake ($0 \rightarrow \text{Current kcal}$) with dashed forecast projection toward the 2269 kcal daily goal
- Live reactive updates via `meal-history-updated` event

### Results & Review
- **Multi-Tier Vision Cascade:** Groq Vision (Tier 1 fast LPU) → Google Gemini 2.0 Flash (Tier 2 high accuracy) → OpenRouter (Tier 3 free cascade) → Gemini 1.5 Fallback (Tier 4) → Hugging Face (Tier 5)
- Direct 1-tap `[ 🛒 Add to Grocery / বাজারে যোগ ]` button next to Share button for instant grocery addition
- Confidence scores with color-coded badges (high/medium/low)
- Sortable food items (by confidence, calories, name, portion size)
- Portion editing with +/- 25g controls, renaming, replacing, or deleting
- Bulk actions: confirm all, review low-confidence, add custom
- "Frequently eaten with" suggestions
- Glycemic index chips for diabetic profiles
- Share detected items to clipboard

### Nutrients & Analysis
- **Revenue-Style Intake Curve (`RevenueCurveChart.tsx`):** Visual trajectory curve with real Bengali/English X/Y axes (`৮ AM` – `১১ PM`, `০` – `২৫০০` kcal), olive target line, and draw-in animation
- **Smart Dietary Pivot & Market Intelligence (`pivotEngine.ts`):** Tailored meal swaps with exact macro and BDT market price deltas (e.g. Low-Sodium Gravy Pivot, Pasta & Steamed Veggies Swap, Antioxidant Salad Booster)
- 1-click `[ 🛒 Add pivot items to Grocery List ]` button automatically adding swap ingredients with categories
- Animated macro donut charts (protein, carbs, fat) with deep ink (`#2E2522`) high-contrast numbers
- Modern 10px gradient pill meters (`Bar.tsx`) with benchmark notches and over-target badges
- SHAP-style explainability strip with per-item contributions
- Share nutrition summary to clipboard

### AI Coach
- **Persona:** Dr. Susmit (পুষ্টি বিজ্ঞানী / Nutrition Scientist)
- **Dual Expertise:** Biochemical & nutritional analysis paired with empathetic habit coaching (CBT habit science & WHO/ICMR lifestyle protocols)
- **Bilingual & Cultural:** Seamless English & Bengali support tailored for regional diets, feasts, dawats, and cravings
- **Scientific Transparency:** Evidence-based citations (INFS/BIRDEM guidelines, WHO protocols)

### Profile
- Editable health goals: prediabetic-friendly, high-protein, budget-aware, Mediterranean
- Dietary preferences: Vegetarian, Vegan, Pescatarian, Gluten-free, Dairy-free, Halal, Kosher
- Allergen tracking: Peanuts, Tree nuts, Shellfish, Soy, Eggs, Dairy, Gluten, Sesame
- Daily grocery budget stepper (scales to weekly cap)
- Serving size adjustment
- User statistics: total meals logged, days active, avg kcal/day

### Grocery
- Weekly grocery list with category grouping (Grains & staples, Produce, Protein)
- Check items as bought with strike-through
- Inline price editing (BDT currency)
- Add custom items with name + price + category
- 1-tap addition from ResultsScreen and NutrientsScreen pivot cards
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

## Backend

The image-analysis and nutrition-resolution flows call the FastAPI service:

- **FastAPI** (Python 3.11)
- **Vision cascade**: **Groq Vision** (Tier 1 fast LPU via `llama-3.2-11b-vision-preview` / `llama-3.2-90b-vision-preview`) → **Gemini 2.0 Flash** (Tier 2 primary high-accuracy vision) → **OpenRouter Vision** (Tier 3 free cascade) → **Gemini 1.5 Fallback** (Tier 4) → optional **Hugging Face** classifier (Tier 5 validator)
- **Nutrition cascade**: Open Food Facts → USDA → Fruityvice + global/regional Bangladeshi food composition databases
- **Cache**: ChromaDB vector cache lookup plus SQLite TTL writes

Set `VITE_API_BASE` to the backend URL in the Vercel project settings. Set
`GROQ_API_KEY`, `GEMINI_API_KEY`, and/or `OPENROUTER_API_KEY` on the backend host (Render); `HF_API_TOKEN` is optional.
The image-analysis route returns an error when no vision provider is
configured and never substitutes sample detections for an uploaded photo.

**Production limitation:** authentication, profile/grocery/meal persistence,
and several dashboard values still use seeded or browser-local demo data.
The backend currently stores state in a JSON file and is not a multi-user
database. Do not treat those features as production-ready or deploy them
for real user accounts until authentication and durable per-user storage
are implemented.

## Clinical Formulas & Dynamic Target Standards

NutriVision AI calculates targets dynamically rather than using static constants:

1. **Basal Metabolic Rate (BMR):** Mifflin-St Jeor Equation
   $$\text{BMR}_{\text{male}} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age} + 5$$
   $$\text{BMR}_{\text{female}} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age} - 161$$
   *(Citation: Mifflin MD, St Jeor ST, et al. Am J Clin Nutr 1990; 51:241-247)*
2. **Total Daily Energy Expenditure (TDEE):** $\text{TDEE} = \text{BMR} \times \text{Activity Multiplier}$
   - Sedentary: $1.20$, Light: $1.375$, Moderate: $1.55$, Active: $1.725$, Very Active: $1.90$
3. **Calorie Deficit / Surplus Limits:**
   - Capped at maximum $\pm 1000\text{ kcal/day}$ with clinical safety floors enforced ($1500\text{ kcal}$ for adult men, $1200\text{ kcal}$ for adult women, $1000\text{ kcal}$ for children).
4. **Macronutrient Split (AMDR):**
   - Standard: 50% Carbs, 20% Protein, 30% Fat
   - Diabetic / Prediabetic: 38% Carbs, 25% Protein, 37% Fat
   - High Protein: 40% Carbs, 32% Protein, 28% Fat
   - Renal / Kidney Condition: Protein capped at $0.8\text{ g/kg}$ of body weight
5. **Micronutrient Rules:**
   - Fiber: Children (age $<14$) $\rightarrow \text{age} + 5\text{g}$; Adults $\rightarrow 14\text{g} / 1000\text{ kcal}$ (min $30\text{g}$ for diabetic profiles).
   - Sodium: $\le 1500\text{ mg/day}$ for hypertension or renal conditions; $\le 2300\text{ mg/day}$ for standard adults; $\le 1200\text{ mg/day}$ for children $<8$ yo.
   - Sugar: Max $5\%$ of total calories for diabetic profiles; max $10\%$ for general health (WHO 2015 guideline).

---

## How to Extend & Customize

### Adding a Vision Provider
Define the provider entry in [`app/data/vision_providers.json`](./app/data/vision_providers.json):
```json
{
  "name": "my_new_provider",
  "model": "model-identifier",
  "base_url": "https://api.provider.com/v1",
  "timeout_seconds": 15.0,
  "max_retries": 2,
  "enabled": true
}
```

### Adding a Local / Regional Food Item
Add the food entry to [`app/data/bd_food_composition.json`](./app/data/bd_food_composition.json):
```json
"ilish macher jhol": {
  "name_en": "Ilish Macher Jhol",
  "name_bn": "ইলিশ মাছের ঝোল",
  "protein": 18.2, "carbs": 2.0, "fat": 14.5, "kcal": 212.0,
  "fiber": 0.8, "sodium": 310.0, "sugar": 0.4, "glycemic": 0.10,
  "emoji": "🐟", "category": "protein",
  "alternatives": ["Rui Macher Jhol"],
  "pairings": ["White Rice", "Green Chili"]
}
```

### Adding a Language or Localization
1. Register translations in [`src/i18n/LanguageContext.tsx`](./src/i18n/LanguageContext.tsx).
2. Set the `language` field on the user profile (`'en'` or `'bn'`).

---

## License

MIT

## Documentation

Comprehensive docs live in [`docs/`](./docs/README.md):

- [Architecture overview](./docs/ARCHITECTURE.md) — the 5-minute orientation
- [What happens when you upload a picture](./docs/IMAGE_UPLOAD_FLOW.md) — frame-by-frame trace from camera to saved meal
- [Agent context](./docs/AGENT_CONTEXT.md) — for AI agents or new developers picking up the project
- [Schema lockstep rules](./docs/schemas.md) — how `src/types/schemas.ts` ↔ `app/models/schemas.py` stay in sync
- [Development guide](./docs/development.md) — setup, tests, smoke-testing the real backend
- [Changelog](./docs/CHANGELOG.md) — what changed in the recent cleanup pass

Per-area deep dives:
- [Frontend](./docs/frontend/README.md) · [Components](./docs/frontend/components.md)
- [Backend](./docs/backend/README.md) · [Services](./docs/backend/services.md)
- [API reference](./docs/api/vision.md) (vision, nutrition, profile, grocery, meals)
