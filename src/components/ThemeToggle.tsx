import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTokens } from '../theme/useTokens';

/**
 * Theme toggle pill — sits in the Profile screen header next to Reset
 * and Sign out. Calls `toggleTheme()` from the ThemeProvider; the
 * pill itself recolors automatically because its bg/border come from
 * `useTokens()`.
 *
 * Icon convention: show the icon of the theme the user is *about to*
 * switch to (Moon when in light → click goes dark; Sun when in dark →
 * click goes light). The label follows the same rule.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTokens();
  const isDark = theme === 'dark';
  // Use a darker-tinted surface in light mode and a lighter-tinted one
  // in dark mode so the pill always reads as elevated against its own bg.
  const pillBg = isDark ? 'rgba(208, 174, 146, 0.10)' : 'rgba(74, 58, 52, 0.08)';
  const pillBorder = isDark ? 'rgba(208, 174, 146, 0.22)' : 'rgba(74, 58, 52, 0.18)';

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      whileHover={{ y: -1, scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 10px',
        borderRadius: 10,
        background: pillBg,
        border: `1px solid ${pillBorder}`,
        color: 'inherit',
        fontFamily: 'Inter',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        minHeight: 28,
      }}
    >
      {isDark ? (
        <Sun size={12} strokeWidth={2.5} />
      ) : (
        <Moon size={12} strokeWidth={2.5} />
      )}
      {isDark ? 'Light' : 'Dark'}
    </motion.button>
  );
}