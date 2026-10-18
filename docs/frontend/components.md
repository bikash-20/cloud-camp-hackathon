# Frontend Components

Per-file purpose for every component in `src/components/`. Use this
as a quick lookup when you're trying to figure out where some
behavior lives.

## Screens (`src/components/screens/`)

### `CaptureScreen.tsx`
The home tab. Largest file in the project (~1100 lines). Composes:
- Top: user greeting, today's kcal progress bar
- Hero card: camera button (rear-camera preferred via `getUserMedia`),
  file-upload fallback, live preview after capture
- Quick action chips: jump to grocery, history, scan, etc.
- Recent meals: last 3 logged, with thumbnails (gradient + emoji
  fallback keyed off `meal.id`)
- "Today's macros" summary card

The camera viewfinder uses an in-screen shutter animation.
After capture, the data URL flows up to `App.tsx` via the
`onCapture` prop and triggers `analyzeMeal`.

### `ResultsScreen.tsx`
The detected-items list after analysis. Features:
- Top: pipeline trace toast (animated, from `pipeline` prop)
- Body: sortable, editable list of `DetectedItem`s
  - Sort: confidence, calories, name, portion size
  - Per-item: confidence ring, name, portion +/- (25g), glycemic chip
  - Edit mode: rename, replace with alternatives, delete
- Bulk action bar (multi-select): confirm all, review low-confidence,
  add custom
- "Frequently eaten with" suggestions from `MOCK_NUTRITION_DB`
- Share detected items to clipboard

### `NutrientsScreen.tsx`
The analysis tab after the user confirms items. Features:
- Top: meal photo thumbnail, date/time, total kcal
- Macro donut charts (protein, carbs, fat) with animated count-up
- Linear progress bars for fiber, sodium, sugar
- "Why these flags?" strip — each `NutrientContribution` rendered
  as a verdict chip with reason text
- Share nutrition summary to clipboard
- "Save meal" button → triggers `saveMeal(meal)` in `api.ts`

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

### `Bar.tsx`
A **labeled** progress bar. Different from `MiniBar`:
- Has a label row above
- Has hover effect
- Has drop-shadow
- Used in sections that need explanatory labels (e.g. "Sodium:
  850mg / 2300mg")

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
The 5-tab dock at the bottom of the phone frame. Highlights the
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