# Frontend Components

Per-file purpose for every component in `src/components/`. Use this
as a quick lookup when you're trying to figure out where some
behavior lives.

## Screens (`src/components/screens/`)

### `CaptureScreen.tsx`
The home tab. Composes:
- Top: user greeting, today's summary with integrated FinTech revenue spline curve (`RevenueCurveChart`) or macro progress bars.
- Hero card: camera button (rear-camera preferred via `getUserMedia`), file-upload fallback, live preview after capture, and retake controls.
- Quick action chips: jump to grocery, history, scan, etc.
- Recent meals: last logged meals with thumbnails (gradient + emoji fallback keyed off `meal.id`).
- Real-time reactive updates: listens to the `meal-history-updated` event to refresh today's totals and recent meals without requiring page reloads.

The camera viewfinder uses an in-screen shutter animation.
After capture, the data URL flows up to `App.tsx` via the
`onCapture` prop and triggers `analyzeMeal`.

### `ResultsScreen.tsx`
The detected-items list after analysis. Features:
- Top: pipeline trace toast (animated, from `pipeline` prop) and step progression header (`Review` → `Adjust` → `Confirm`).
- Direct grocery addition: 1-tap `[ 🛒 Add to Grocery / বাজারে যোগ ]` button next to the Share button, allowing one-click synchronization of detected items into the grocery list.
- Body: sortable, editable list of `DetectedItem`s
  - Sort: confidence, calories, name, portion size
  - Per-item: confidence ring, name, portion +/- (25g), glycemic chip
  - Edit mode: rename, replace with alternatives, delete
- Real-time sync: when portions are adjusted, updates the latest entry in `mealHistory` and broadcasts `meal-history-updated`.
- Bulk action bar (multi-select): confirm all, review low-confidence, add custom
- "Frequently eaten with" suggestions from `MOCK_NUTRITION_DB`
- Share detected items to clipboard

### `NutrientsScreen.tsx`
The analysis tab after the user confirms items. Features:
- Top: meal photo thumbnail, date/time, total kcal, and contextual subtitle.
- **Revenue-Style Intake Curve (`RevenueCurveChart.tsx`):**
  - Smooth Catmull-Rom spline curve with soft orange gradient fill showing actual meal intake.
  - Dashed projection forecast curve gently continuing toward the daily target (e.g. 2269 kcal) by evening, labeled as **পূর্বাভাস / Forecast**.
  - Olive target line (`দৈনিক লক্ষ্য ২২৬৯` / `Target: 2269 kcal`).
  - Bengali and English X/Y axes ticks (`৮ AM`, `১২ PM`, `৪ PM`, `৮ PM`, `১১ PM`; `০`, `১০০০`, `২০০০`, `২৫০০` kcal) with draw-in animation and high-contrast stat chips.
  - Accurately reports meal calories and true count of logged meals (`todaySummary.mealsLogged`).
- **Smart Dietary Pivot & Market Intelligence (`pivotEngine.ts`):**
  - Tailored meal swap cards with exact macro and BDT market price deltas (e.g. Low-Sodium Gravy Pivot, Pasta & Steamed Veggies Swap, or Antioxidant Salad Booster).
  - 1-click `[ 🛒 Add pivot items to Grocery List ]` button that syncs recommended swap ingredients directly into the grocery list.
- Macro donut charts (protein, carbs, fat) with animated count-up and deep ink (`#2E2522`) labels.
- Modern 10px gradient pill meters (`src/components/Bar.tsx`) with benchmark notches for fiber, sodium, and sugar.
- SHAP-style explainability strip with 8px pill gauges and bold percentage tags.
- Share nutrition summary to clipboard.
- "Save meal" button → triggers `saveMeal(meal)` in `api.ts`.

### `ProfileScreen.tsx`
The user-settings tab. Features:
- Editable name
- 4 health goal toggles (diabetic, protein, budget, Mediterranean)
- Dietary preferences (7 options)
- Allergens (8 options)
- Daily grocery budget stepper (BDT currency, scales to weekly cap)
- Serving size stepper
- User stats: total meals, days active, avg kcal/day, streak
- Reset button (restores `DEFAULT_PROFILE`)

### `GroceryScreen.tsx`
The grocery-list tab. Features:
- Weekly list grouped by category (Grains, Produce, Protein)
- Per-item: checkbox, name, price, inline price edit
- Budget ring (filled green when under, red when over)
- Add custom item
- "Generate from Meals" — adds pairings from `MOCK_NUTRITION_DB` for
  every item in recent meal history
- Clear all (with confirmation)
- Share list to clipboard

### `CoachScreen.tsx`
The AI Coach tab (6th tab in bottom navigation). Features:
- **Persona:** Dr. Susmit (পুষ্টি বিজ্ঞানী / Nutrition Scientist).
- **Dual Expertise:** Biochemical & nutritional analysis paired with empathetic habit coaching based on Cognitive Behavioral Therapy (CBT) and WHO/ICMR lifestyle protocols.
- **Bilingual Conversations:** Seamless English and Bengali dialogue with culturally nuanced guidance (e.g. managing Bengali feasts, dawats, sweets, and evening tea cravings).
- **Scientific Citations:** Transparent citation tags (INFS/BIRDEM guidelines, CBT habit science, WHO lifestyle protocols).
- **Proactive Prompts:** Quick action question chips for fast habit check-ins.
- **Context-Aware:** Analyzes recently uploaded meal photos and profile parameters to answer nutritional questions with personalized context.

## Admin (`src/components/admin/`)

### `AdminLayout.tsx`
Shell for the admin role. Renders a sidebar + content area; uses
`session` from props to fetch the demo user list.

### `AdminOverview.tsx`
Admin home page. Shows KPI cards (total users, meals today, etc.)
and a sparkline of recent activity.

### `KpiCard.tsx`
A single stat card (label + big number + delta).

### `Sparkline.tsx`
Tiny inline SVG line chart used in `AdminOverview`.

## Auth (`src/components/auth/`)

### `LoginScreen.tsx`
**Out of scope.** Mock login — do not modify. Real auth is the
next cut. See [AGENT_CONTEXT.md](../AGENT_CONTEXT.md#dont-touch-explicit-constraints).

## Shared components (`src/components/`)

### `RevenueCurveChart.tsx`
A modern, FinTech revenue-curve style trajectory chart for daily calorie intake and projections:
- **Catmull-Rom Centripetal Spline ($\alpha=0.5$):** Generates $C^1$ smooth cubic Bézier curves across irregular meal time intervals without external chart dependencies.
- **Flowing Area Fill:** Soft terracotta/orange gradient fill under the actual intake line ($0 \rightarrow \text{Current kcal}$, flat after the latest logged meal).
- **Dashed Projection Forecast:** Extrapolates gently toward the daily target (e.g. 2269 kcal) by evening, marked as **পূর্বাভাস / Forecast**.
- **Olive Benchmark Target Line:** Clear dashed reference line (`#4F772D`) labeled `দৈনিক লক্ষ্য ২২৬৯` / `Target: 2269 kcal`.
- **Bilingual Bengali & English Axes:** Localized time stamps on the X-axis (`সকাল ৮টা`, `দুপুর ১২টা`, `বিকাল ৪টা`, `রাত ৮টা`, `রাত ১১টা` or `8 AM`, `12 PM`, `4 PM`, `8 PM`, `11 PM`) and calorie levels on the Y-axis (`০`, `১০০০`, `২০০০`, `২৫০০` kcal) with subtle gridlines.
- **Draw-In SVG Animation:** Curve smoothly draws itself from left to right on card mount with a pulsing active-marker dot and hover/tap tooltips.
- **Macro Stat Chips:** High-contrast progress chips for Protein, Carbs, and Fat with deep ink (`#2E2522`) numbers.
- **Responsive:** Fits phone viewports (320px) to desktop displays cleanly using vector `viewBox="0 0 540 220"`.
- **Props:** Accepts `currentKcal`, `targetKcal`, `mealsLogged`, `todayKcal`, `mealHistory`, and custom `subtitle`.

### `Bar.tsx`
Modern 10px high-contrast gradient pill meter (upgraded from flat plain bars):
- Rounded pill aesthetics with linear color gradients (`#D96B27` $\rightarrow$ `#E87A38`, `#4F772D` $\rightarrow$ `#689F38`, `#DC2626` $\rightarrow$ `#EF4444`).
- Subtle glossy top highlight line for elevated tactile polish.
- Benchmark target notch indicator at 100% position.
- Over-target badge (e.g. `+140%`) when nutrient exceeds safe daily limit.
- High-contrast labels and numeric values using deep ink (`#2E2522`).

### `SummaryCard.tsx`
A reusable summary card with support for dual display modes:
- Header mode toggle: `[ 📈 গতিপথ / Curve | 📊 ম্যাক্রো / Macros ]`.
- Embeds the `RevenueCurveChart` inline for quick visual trajectory inspection.
- Embeds progress pill meters for protein, carb, and fat breakdown.

### `Meter.tsx` (new)
The `MiniBar` and `MacroMeter` components, extracted from
`CaptureScreen`:
- `MiniBar` — compact unlabeled ratio bar (40px tall, no label)
- `MacroMeter` — labeled bar with the value rendered inside the fill

Both are used in `NutrientsScreen` and `CaptureScreen`'s today
summary.

### `PhoneFrame.tsx`
Mobile full-bleed on small screens, desktop phone-mockup frame on
larger screens. Used as the outermost wrapper of `UserApp`.

### `BottomNav.tsx`
The 6-tab dock at the bottom of the phone frame (Capture, Results, Nutrients, Profile, Grocery, AI Coach). Highlights the
active tab, animates the icon with framer-motion.

### `ErrorBoundary.tsx`
Top-level React error catch. Renders a styled fallback with a
"Reload" button.

### `ExpandableRow.tsx`
The collapsible food item row used in `ResultsScreen`. Tap to
expand, show the edit controls (portion +/-, rename, replace,
delete).

### `SummaryCard.tsx`
A reusable "summary" card with a title, value, and optional
sub-label. Used in many places (today's kcal, weekly budget ring,
user stats).

### `SortMenu.tsx`
Dropdown menu for the sort options on `ResultsScreen`. Animates
open/close with framer-motion.

### `BulkActionBar.tsx`
The multi-select action bar that appears at the bottom of
`ResultsScreen` when items are selected.

### `SmartActionSheet.tsx`
A bottom-sheet-style confirmation dialog. Used for "Delete meal?",
"Clear all grocery items?", etc.

### `AddCustomModal.tsx`
Modal for adding a custom food item to `ResultsScreen` (name,
portion, calories).

### `ConfidenceRing.tsx`
Animated SVG progress ring. Used in `ResultsScreen` to show per-item
confidence.

### `PhotoThumb.tsx`
A small square photo thumbnail with rounded corners. Used in
`NutrientsScreen` (meal photo) and meal history.

### `PwaInstallBanner.tsx`
A dismissible banner that prompts the user to install the PWA.
Listens for the `beforeinstallprompt` event.

### `SectionLabel.tsx`
A reusable section header with a label + optional action button
(e.g. "Recent meals · See all").

### `Chip.tsx`
A small toggleable chip. Used for dietary preferences, allergens,
filter pills.

### `Pill.tsx`
A non-toggleable pill. Used for status indicators (e.g. "Low
confidence", "Diabetic-friendly").

### `StepDots.tsx`
Three animated dots that pulse while analysis is running.

### `StepIndicator.tsx`
A more detailed step indicator with labels (used in some tooltips
and the admin dashboard).

### `ThemeToggle.tsx`
Light/dark mode toggle button. Wired to `ThemeContext`.

## Hooks (`src/components/useCountUp.ts`)

### `useCountUp`
Animates a number from 0 to a target value. Used in the macro donut
charts and KPI cards.

```ts
const value = useCountUp(target, { duration: 800 });
```

The animation respects `prefers-reduced-motion` (returns the target
instantly when the user prefers reduced motion).