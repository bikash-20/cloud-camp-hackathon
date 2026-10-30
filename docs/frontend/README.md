# Frontend Architecture & Component Guide

React 18 + Vite + TypeScript Progressive Web App (PWA) with responsive design, Google OAuth authentication, dark/light theme hydration, and English/Bengali localization.

---

## 1. Application Shell & State Flow

**File:** `src/App.tsx`

```
┌──────────────────────────────────────────────┐
│              <ThemeProvider>                 │
│         (ThemeContext.tsx + Tokens)          │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                  <AppShell>                  │
│                                              │
│  1. Synchronous check of `getSession()`      │
│  2. If unauthenticated ──▶ <LoginScreen>    │
│  3. If role === 'admin' ──▶ <AdminLayout>    │
│  4. If role === 'user'  ──▶ <UserApp>        │
└──────────────────────────────────────────────┘
```

### Pre-Paint Theme Hydration
To eliminate the light-mode flash on page load, `index.html` executes a synchronous inline script in `<head>`:
```javascript
(function () {
  try {
    var stored = localStorage.getItem('nv_theme');
    var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } catch (e) {}
})();
```
This guarantees that `data-theme="dark"` is already attached to `<html>` prior to the first CSS paint and DOM mounting.

---

## 2. Authentication Flow

**Files:** `src/lib/auth.ts`, `src/components/auth/LoginScreen.tsx`

- Uses **Google Identity Services (GIS)** via `@react-oauth/google`.
- The `LoginScreen` renders the official Google sign-in button and Google One-Tap prompt.
- On successful authorization:
  1. The Google ID token is dispatched to `POST /api/auth/google`.
  2. The backend verifies the token with Google public JWKS certificates and returns a secure session JWT.
  3. `loginWithGoogle()` persists the session in `localStorage['nv_auth']`.
  4. Role determination: Users whose verified email is listed in `ADMIN_EMAILS` are granted `admin` access; all others receive `user` access.
  5. The application dynamically routes admins to `<AdminLayout>` and regular users to `<UserApp>`.

---

## 3. Screen Routing

### A. User PWA (6 Tabs)
In `<UserApp>`, navigation uses a zero-overhead `useState` tab ladder:
```typescript
const [activeTab, setActiveTab] = useState(0);
```

| Index | Screen | Purpose |
|---|---|---|
| `0` | `CaptureScreen` | Camera viewfinder (`getUserMedia`), Catmull-Rom calorie intake curve, and today's summary. |
| `1` | `ResultsScreen` | Detected food items, bounding box confidence, portion adjustments, and 1-tap grocery add. |
| `2` | `NutrientsScreen` | Macro donut charts, SHAP-style explainability, and smart dietary pivot recommendations. |
| `3` | `ProfileScreen` | Health goals, dietary preferences, allergens, daily grocery budget stepper, and user stats. |
| `4` | `GroceryScreen` | Categorized weekly grocery checklist with budget tracking ring and inline pricing. |
| `5` | `CoachScreen` | Dr. Susmit AI habit and culinary nutrition scientist (bilingual English/Bengali). |

### B. Admin Intelligence Portal (4 Views)
In `<AdminLayout>`, the admin dashboard provides 4 active navigable views:
- **Overview (`'overview'`):** Real-time platform KPIs, active users, auto-refresh every 30s, and dynamic 7-day meal volume sparkline.
- **Users Directory (`'users'`):** Searchable and sortable table of all registered users with avatar, joined date, streak days, and slide-over user inspection modal.
- **Popular Foods (`'popular'`):** Ranked food item frequencies with date-range filters (`Today`, `7 Days`, `30 Days`, `All Time`) and share percentage progress bars.
- **Review Queue (`'review'`):** Low-confidence (<70%) meals audit log with modal actions for approval, dish label correction, and dismissal.

---

## 4. API Client (`src/lib/api.ts`)

The typed API client manages communication with the FastAPI backend:
- Automatically injects `Authorization: Bearer <token>` from the active Google auth session.
- Normalizes snake_case backend payloads to TypeScript camelCase interfaces.
- Intercepts `401 Unauthorized` responses to clear invalid sessions and redirect to login.

### Key API Methods:
- `analyzeMeal(imageRef)`: Submits photo base64 to `/api/vision/analyze`.
- `resolveNutrition(items, profile)`: Queries `/api/nutrition/resolve`.
- `getAdminMetrics()`: Fetches live platform telemetry (`/api/admin/metrics`).
- `getAdminUsers(params)`: Queries searchable user directory (`/api/admin/users`).
- `getAdminUserDetail(email)`: Fetches user profile and meal history (`/api/admin/users/{email}`).
- `getAdminPopularFoods(range)`: Fetches food rankings (`/api/admin/popular-foods`).
- `getAdminReviewQueue(status)`: Fetches flagged meals (`/api/admin/review-queue`).
- `updateReviewQueueItem(id, update)`: Approves, corrects, or dismisses flagged meals.

---

## 5. Design System & Accessibility

- **Palette:** Warm earth-tone system (`tokens.ts`) with adaptive dark-mode tokens for high contrast and reduced eye fatigue.
- **WCAG AA Compliance:** Text contrast ratio $\ge 4.5:1$ on all backgrounds, interactive focus rings, screen reader attributes (`aria-label`, `role`, `aria-expanded`), and full keyboard navigation.
- **Localization:** Real-time translation dictionary (`LanguageContext.tsx`) translating all UI text, food names, and clinical guidance between English and authentic Bengali.
