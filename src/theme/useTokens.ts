import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './ThemeContext';

/**
 * Read the active token set. Components that want to react to the theme
 * should call this instead of importing `T` directly from `data.ts`.
 *
 * Returns the full context value so callers can also read `theme`,
 * `toggleTheme`, and `setTheme` from the same hook.
 */
export function useTokens(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Shorthand for components that only care about the tokens. */
export function useActiveTokens() {
  return useContext(ThemeContext).tokens;
}

/** Shorthand for components that only need to know if dark mode is on. */
export function useIsDark(): boolean {
  return useContext(ThemeContext).theme === 'dark';
}