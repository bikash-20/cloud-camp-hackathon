import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as storage from '../lib/storage';
import { darkTokens, lightTokens, setActiveTokens, type TokenShape } from './tokens';

export type ThemeName = 'light' | 'dark';

export interface ThemeContextValue {
  theme: ThemeName;
  tokens: TokenShape;
  toggleTheme: () => void;
  setTheme: (next: ThemeName) => void;
}

/**
 * Light is the explicit default — first-time visitors and any caller that
 * never persisted a preference land here. The CSS `:root` block in
 * styles.css is written for light, so we only need to override
 * `[data-theme="dark"]` (not also the bare `:root`).
 */
const THEME_KEY = 'theme';

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  tokens: lightTokens,
  toggleTheme: () => {},
  setTheme: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * ThemeProvider — owns the active theme, syncs it to `data-theme` on
 * `<html>` (so CSS-variable-driven styles flip), pushes it to the
 * module-level `setActiveTokens` (so the `T` Proxy re-exports the
 * correct values for the 237+ call sites that read `T.foo` directly),
 * and persists it to `nv_theme` in localStorage.
 *
 * Theme is global, not per-user, matching the demo's mock-grade model.
 * No server round-trip; no flash protection beyond the inline default.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const stored = storage.load<ThemeName>(THEME_KEY);
    const initial = stored === 'dark' ? 'dark' : 'light';
    // Sync the active token set synchronously so the very first render
    // reads the correct tokens through the T Proxy — no light→dark flash.
    setActiveTokens(initial === 'dark' ? darkTokens : lightTokens);
    return initial;
  });

  // Apply the active token set to the module-level pointer the T Proxy
  // reads from. Synchronous so the very next render reads the right values.
  useEffect(() => {
    setActiveTokens(theme === 'dark' ? darkTokens : lightTokens);
  }, [theme]);

  // Sync the DOM attribute so CSS-only rules can also flip.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    storage.save(THEME_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      tokens: theme === 'dark' ? darkTokens : lightTokens,
      toggleTheme,
      setTheme,
    }),
    [theme, toggleTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}