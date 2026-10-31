import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTokens } from '../theme/useTokens';
import { LocalizedContent, useLanguage } from '../i18n/LanguageContext';

/**
 * Theme toggle pill — high-contrast button to flip between warm earth light and dark.
 * Clearly visible on both dark admin sidebars and user screen headers.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTokens();
  const { language } = useLanguage();
  const isBn = language === 'bn';
  const isDark = theme === 'dark';

  return (
    <LocalizedContent>
      <motion.button
        type="button"
        onClick={toggleTheme}
        whileHover={{ y: -1, scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        aria-label={isDark ? (isBn ? 'লাইট মোড চালু করুন' : 'Switch to light mode') : (isBn ? 'ডার্ক মোড চালু করুন' : 'Switch to dark mode')}
        aria-pressed={isDark}
        className="theme-toggle-btn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 11px',
          borderRadius: 10,
          background: isDark ? 'rgba(232, 196, 154, 0.18)' : 'rgba(249, 242, 228, 0.14)',
          border: isDark ? '1px solid rgba(232, 196, 154, 0.40)' : '1px solid rgba(249, 242, 228, 0.30)',
          color: isDark ? '#E8C49A' : '#F9F2E4',
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          minHeight: 28,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
        }}
      >
        {isDark ? (
          <Sun size={13} strokeWidth={2.5} color="#E8C49A" />
        ) : (
          <Moon size={13} strokeWidth={2.5} color="#F9F2E4" />
        )}
        <span style={{ color: isDark ? '#E8C49A' : '#F9F2E4' }}>
          {isDark ? (isBn ? 'লাইট' : 'Light') : (isBn ? 'ডার্ক' : 'Dark')}
        </span>
      </motion.button>
    </LocalizedContent>
  );
}