# Frontend

React 18 + Vite + TypeScript PWA. It uses a hybrid API client
(`src/lib/api.ts`): image analysis and nutrition resolution call the
FastAPI backend when `VITE_API_BASE` is configured; profile, grocery,
meal history, and authentication remain browser-local/demo behavior.

## App shell

**File:** `src/App.tsx`

```
<ThemeProvider>
  <AppShell />
</ThemeProvider>
```

`AppShell`:
1. On mount, reads `nv_auth` from localStorage via `getSession()`.
2. If no session → renders `<LoginScreen>`.
3. If `session.role === 'admin'` → renders `<AdminLayout>` with `<AdminOverview>`.
4. Otherwise → renders `<UserApp session={session}>`.

`UserApp`:
1. Reads profile, today summary, and meal history from browser-local state.
2. Owns the `activeTab` state (`0..5` for the 6 main tabs).
3. Renders `<PhoneFrame>` wrapping the active `<Screen>`.
4. Renders `<BottomNav>` for tab switching.
5. Renders `<StepDots>` (the animated progress strip).
6. Renders `<PwaInstallBanner>` for the PWA install prompt.

The `CaptureScreen` is the home screen, combining the camera viewfinder, shutter animation, FinTech revenue-curve trajectory, and recent-meals history.

## Routing

There is no React Router. Routing is a `useState` ladder:

```ts
const [activeTab, setActiveTab] = useState(0);

const screens = [<CaptureScreen />, <ResultsScreen />, <NutrientsScreen />, <ProfileScreen />, <GroceryScreen />, <CoachScreen />];
return screens[activeTab];
```

The six tabs map to:
- `0` → `CaptureScreen` (home + camera + revenue curve)
- `1` → `ResultsScreen` (detected items + 1-tap grocery add)
- `2` → `NutrientsScreen` (spline trajectory + smart dietary pivots + donuts)
- `3` → `ProfileScreen` (goals + prefs + allergens)
- `4` → `GroceryScreen` (weekly list with category grouping)
- `5` → `CoachScreen` (Dr. Susmit AI habit & nutrition scientist)

Cross-tab navigation (e.g. "Open grocery" from the CaptureScreen's
quick-action chips) uses `TAB_GROCERY` which is derived from
`MOCK_TABS.findIndex(t => t.id === 'grocery')` so reordering tabs
in `MOCK_TABS` doesn't break navigation.

## State management

**There is no Redux, no Zustand, no React Query.** State lives in:

- **App-level state** (`useState` in `App.tsx#UserApp`): active tab,
  session, profile, today summary, meal history.
- **Component-local state** (`useState` in each screen): form
  values, UI toggles, transient captures.
- **localStorage** (`src/lib/storage.ts`): persistent profile,
  meal history, grocery list, theme preference, auth session.

Profile, meal history, and grocery mutations currently read/write
localStorage; they are not synchronized to per-user backend storage.

## API and local demo state

**File:** `src/lib/api.ts`

This file contains live backend calls for `analyzeMeal` and, when
configured, `resolveNutrition`. Other functions still use localStorage,
seed data, or local calculations:

- `analyzeMeal(imageRef)` → `AnalyzeResult`
- `resolveNutrition(items, profile)` → `ResolveNutritionResult`
- `getMacroTargets()` → `MacroTargets`
- `getTodaySummary()` → `TodaySummary`
- `getMealHistory()` → `MealEntry[]`
- `saveMeal(meal)` → `MealEntry`
- `updateLatestMeal(meal)` → updates latest meal in history & fires `meal-history-updated`
- `deleteMeal(id)` → `void`
- `getProfile()` → `UserProfile`
- `updateProfile(profile)` → `UserProfile`
- `getGrocery()` → `GroceryList`
- `addGroceryItem(item)` / `updateGroceryItem` / `removeGroceryItem`
- `clearGrocery()` / `generateGroceryFromMeals()`
- `DEFAULT_PROFILE` (factory-fresh profile for Reset)

The fallback in `resolveNutrition` is for local demo mode only. Vision
analysis never returns canned detections: it fails clearly if the
backend URL/provider is unavailable.

## Helpers (`src/lib/`)

### `pivotEngine.ts`
Smart Dietary Pivot & Market Intelligence engine:
- Generates tailored meal swaps (e.g. low-sodium gravy pivot, pasta-to-veggie swap, high-carb brown rice replacement, antioxidant produce booster).
- Computes exact macro deltas ($\Delta\text{kcal}$, $\Delta\text{carbs}$, $\Delta\text{fiber}$, $\Delta\text{sodium}$) and BDT market price impact ($\Delta\text{BDT}$).
- Provides actionable grocery items with categories (`Produce`, `Protein`, `Grains & staples`) for 1-click addition to `GroceryScreen`.

### `format.ts`
Pure helpers extracted from `CaptureScreen`:
- `formatRelative(iso, now?)` — "just now" / "5m ago" / "Yesterday" / weekday / month-day
- `hashStr(s)` — deterministic string hash (stable color from name)
- `pickThumbnailStyle(meal, descriptorEmojis)` — gradient + emoji swatch for a meal thumbnail

### `personalize.ts`
Flag rules + meal totals. Mirrors `app/services/personalize.py`:
- `mealTotals(items)` — zeros when no items, scales by grams correctly
- `getEffectiveNutrition(item)` — canonical lookup across global and regional foods (pasta, spaghetti, parsley, local dishes)
- `buildContributions(items, targets, focusedNutrients)` — SHAP-style per-nutrient contributions
- `focusedNutrients(profile)` — diabetic vs non-diabetic focus list
- `FLAG_RULES` — the rule table that powers the verdict chips

### `storage.ts`
Typed localStorage wrapper:
- `load<T>(key)`, `loadOrDefault<T>(key, default)`, `save<T>(key, value)`, `clear(key)`
- Catches `QuotaExceededError` and logs a warning (the UI shows no error to the user).

## Design system (`src/theme/`)

### `tokens.ts`
Earth-tone palette and spacing/typography tokens:
- Browns: `#4A3A34` (text) → `#F9F2E4` (background)
- Accents: terracotta, olive, sage, mustard
- Typography: Inter (UI), Fraunces (display), IBM Plex Mono (data)

Exposed via the `T` object re-exported from `src/data.ts` (shim).

### `ThemeContext.tsx`
Light/dark mode provider. Reads from localStorage, falls back to
`prefers-color-scheme`. Exposes `useTheme()` hook.

### `useTokens.ts`
Optional typed accessor for tokens outside the React tree.

## Conventions

- **Inline styles for one-offs**, CSS classes for reusable patterns.
  Reusable patterns live in `src/styles.css` (glass utilities,
  skeleton loaders, button reset).
- **All animations via framer-motion.** Respect `prefers-reduced-motion`
  via `useReducedMotion()` — replace spring physics with instant
  transitions when the user prefers reduced motion.
- **Tab indices are computed**, not hardcoded. See `TAB_GROCERY` in
  `CaptureScreen.tsx`.
- **No new imports from `src/data.ts`** — use `src/mocks/fixtures.ts`
  or `src/theme/tokens.ts` directly. The shim exists for backward
  compat.

For per-component docs, see [components.md](./components.md).