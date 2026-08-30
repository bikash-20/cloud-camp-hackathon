import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { T } from '../data';

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
}

/**
 * Tag-style chip with check toggle. Used for dietary preferences and allergens.
 */
export default function Chip({
  label,
  active,
  onClick,
  ariaLabel,
  size = 'md',
}: ChipProps) {
  const padding = size === 'sm' ? '6px 10px' : '8px 14px';
  const fontSize = size === 'sm' ? 11.5 : 12.5;

  return (
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
        background: active ? T.primary : 'rgba(249, 242, 228, 0.7)',
        border: active
          ? `1px solid ${T.primary}`
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
        backdropFilter: active ? 'none' : 'blur(8px) saturate(130%)',
        WebkitBackdropFilter: active ? 'none' : 'blur(8px) saturate(130%)',
      }}
    >
      <AnimatePresence>
        {active && (
          <motion.span
            key="dot"
            initial={{ scale: 0, opacity: 0, width: 0 }}
            animate={{ scale: 1, opacity: 1, width: 14 }}
            exit={{ scale: 0, opacity: 0, width: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              display: 'inline-flex',
              overflow: 'hidden',
              height: 14,
            }}
          >
            <Check size={12} color="#FFFFFF" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
      <span>{label}</span>
    </motion.button>
  );
}