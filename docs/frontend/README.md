# Frontend

React 18 + Vite + TypeScript PWA. Currently uses a mock API client
(`src/lib/api.ts`); designed so that swapping to real `fetch()`
calls is a one-file change.

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
1. Reads profile, today summary, and meal history from the mock API.
2. Owns the `activeTab` state (`0..4` for the 5 main tabs).
3. Renders `<PhoneFrame>` wrapping the active `<Screen>`.
4. Renders `<BottomNav>` for tab switching.
5. Renders `<StepDots>` (the animated progress strip).
6. Renders `<PwaInstallBanner>` for the PWA install prompt.

The `CaptureScreen` is the largest single file (~1100 lines). It
combines the home screen, the camera viewfinder, the shutter
animation, and the recent-meals history.

## Routing

There is no React Router. Routing is a `useState` ladder:

```ts
const [activeTab, setActiveTab] = useState(0);

const screens = [<CaptureScreen />, <ResultsScreen />, ...];
return screens[activeTab];
```

The five tabs map to:
- `0` → `CaptureScreen` (home + camera)
- `1` → `ResultsScreen` (detected items)
- `2` → `NutrientsScreen` (donuts + explainability)
- `3` → `ProfileScreen` (goals + prefs + allergens)
- `4` → `GroceryScreen` (weekly list)

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

The mock API client (`src/lib/api.ts`) reads/writes localStorage
on every mutation. Swapping to real `fetch()` calls would route
mutations through the backend instead.

## Mock API layer

**File:** `src/lib/api.ts`

This file is the swap target. It exports:

- `analyzeMeal(imageRef)` → `AnalyzeResult`
- `resolveNutrition(items, profile)` → `ResolveNutritionResult`
- `getMacroTargets()` → `MacroTargets`
- `getTodaySummary()` → `TodaySummary`
- `getMealHistory()` → `MealEntry[]`
- `saveMeal(meal)` → `MealEntry`
- `deleteMeal(id)` → `void`
- `getProfile()` → `UserProfile`
- `updateProfile(profile)` → `UserProfile`
- `getGrocery()` → `GroceryList`
- `addGroceryItem(item)` / `updateGroceryItem` / `removeGroceryItem`
- `clearGrocery()` / `generateGroceryFromMeals()`
- `DEFAULT_PROFILE` (factory-fresh profile for Reset)

Every function returns a `Promise` with simulated latency
(`delay(min, max)`). Swapping to real `fetch()` calls preserves the
signatures and return types, so screens don't need to change.

The file header comment documents the swap procedure.

## Helpers (`src/lib/`)

### `format.ts`
Pure helpers extracted from `CaptureScreen`:
- `formatRelative(iso, now?)` — "just now" / "5m ago" / "Yesterday" / weekday / month-day
- `hashStr(s)` — deterministic string hash (stable color from name)
- `pickThumbnailStyle(meal, descriptorEmojis)` — gradient + emoji swatch for a meal thumbnail

### `personalize.ts`
Flag rules + meal totals. Mirrors `app/services/personalize.py`:
- `mealTotals(items)` — zeros when no items, scales by grams correctly
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