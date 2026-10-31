import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { T } from '../data';
import { useTokens } from '../theme/useTokens';
import { LocalizedContent } from '../i18n/LanguageContext';

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
}

/**
 * Tag-style chip with check toggle. Used for medical conditions, dietary preferences, and allergens.
 *
 * Memoized to prevent unnecessary re-renders when sibling chips toggle — only
 * re-renders when its own `active` or `label` props change.
 */
const Chip = memo(function Chip({
  label,
  active,
  onClick,
  ariaLabel,
  size = 'md',
}: ChipProps) {
  const { theme } = useTokens();
  const isDark = theme === 'dark';
  const padding = size === 'sm' ? '6px 10px' : '8px 14px';
  const fontSize = size === 'sm' ? 11.5 : 12.5;

  return (
    <LocalizedContent>
      <motion.button
        type="button"
        onClick={onClick}
        aria-pressed={!!active}
        aria-label={ariaLabel || `Toggle ${label}`}
        whileHover={{ y: -1, scale: 1.03 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding,
          borderRadius: 18,
          background: active ? T.primary : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(249, 242, 228, 0.7)'),
          border: active
            ? `1px solid ${T.primary}`
            : isDark
            ? '1px solid rgba(255, 255, 255, 0.14)'
            : '1px solid rgba(74, 58, 52, 0.15)',
          boxShadow: active
            ? `0 6px 14px -4px ${T.primary}66, inset 0 1px 0 rgba(255,255,255,0.30)`
            : 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 6px -3px rgba(46,37,34,0.10)',
          cursor: 'pointer',
          fontFamily: 'Inter',
          fontSize,
          fontWeight: 600,
          color: active ? '#FFFFFF' : T.ink,
          whiteSpace: 'nowrap',
          minHeight: 36,
          backdropFilter: 'blur(8px) saturate(130%)',
          WebkitBackdropFilter: 'blur(8px) saturate(130%)',
          transition:
            'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease',
        }}
      >
        <AnimatePresence initial={false}>
          {active && (
            <motion.span
              key="dot"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.14 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 14,
                height: 14,
                flexShrink: 0,
              }}
            >
              <Check size={12} color="#FFFFFF" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
        <span>{label}</span>
      </motion.button>
    </LocalizedContent>
  );
});

export default Chip;
