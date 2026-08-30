import { motion } from 'framer-motion';
import { T } from '../data';

interface PillProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: 'accent' | 'warning';
  layoutId?: string;
  ariaLabel?: string;
}

/** Toggle pill for the Profile screen. */
export default function Pill({
  children,
  active,
  onClick,
  tone = 'accent',
  layoutId = 'pill-bg',
  ariaLabel,
}: PillProps) {
  const activeBg = tone === 'warning' ? T.accentWarn : T.primary;
  const activeColor = '#FFFFFF';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      aria-label={ariaLabel}
      whileHover={!active ? { y: -1, scale: 1.02 } : { y: -1, scale: 1.03 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      style={{
        position: 'relative',
        background: active ? 'transparent' : 'rgba(249, 242, 228, 0.7)',
        color: active ? activeColor : T.ink,
        border: active
          ? '1px solid transparent'
          : '1px solid rgba(74, 58, 52, 0.18)',
        borderRadius: 20,
        padding: '8px 14px',
        fontFamily: 'Inter',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        minHeight: 36,
        backdropFilter: active ? 'none' : 'blur(8px) saturate(130%)',
        WebkitBackdropFilter: active ? 'none' : 'blur(8px) saturate(130%)',
        boxShadow: active
          ? `0 6px 14px -4px ${activeBg}80, inset 0 1px 0 rgba(255,255,255,0.35)`
          : 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 6px -3px rgba(46,37,34,0.12)',
      }}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 20,
            background: activeBg,
            border: '1px solid transparent',
            zIndex: 0,
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
    </motion.button>
  );
}