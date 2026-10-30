import { motion, useReducedMotion } from 'framer-motion';
import { T } from '../data';
import { LocalizedContent } from '../i18n/LanguageContext';

interface BarProps {
  label: string;
  pct: number;
  color: string;
  sub?: string;
  delay?: number;
  targetPct?: number;
}

/**
 * Stylish modern metric pill meter with gradient fills, target notch,
 * and high-contrast typography.
 */
export default function Bar({
  label,
  pct,
  color,
  sub,
  delay = 0,
  targetPct = 100,
}: BarProps) {
  const reduceMotion = useReducedMotion();
  const clampedPct = Math.max(0, Math.min(100, pct));
  const isOver = pct > targetPct;

  // Derive stylish gradient
  const gradientFill =
    color === T.primary
      ? 'linear-gradient(90deg, #D96B27 0%, #E87A38 100%)'
      : color === T.accentAmber
      ? 'linear-gradient(90deg, #D97706 0%, #F59E0B 100%)'
      : color === T.accentWarn
      ? 'linear-gradient(90deg, #DC2626 0%, #EF4444 100%)'
      : color === T.accentGood
      ? 'linear-gradient(90deg, #4F772D 0%, #689F38 100%)'
      : `linear-gradient(90deg, ${color}CC 0%, ${color} 100%)`;

  return (
    <LocalizedContent>
      <motion.div
        style={{ marginBottom: 14 }}
        whileHover={{ x: 2 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            marginBottom: 7,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, color: T.ink, letterSpacing: '-0.01em' }}>
              {label}
            </span>
            {isOver && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#B91C1C',
                }}
              >
                {Math.round(pct)}%
              </span>
            )}
          </div>
          {sub && (
            <span
              className="tnum"
              style={{
                fontFamily: "'Inter', sans-serif",
                color: isOver ? '#B91C1C' : T.ink,
                fontSize: 11.5,
                fontWeight: 700,
                background: 'rgba(74, 58, 52, 0.05)',
                padding: '2px 8px',
                borderRadius: 6,
                border: '1px solid rgba(74, 58, 52, 0.08)',
              }}
            >
              {sub}
            </span>
          )}
        </div>

        {/* Outer pill track */}
        <div
          style={{
            position: 'relative',
            height: 10,
            borderRadius: 999,
            background: 'rgba(74, 58, 52, 0.09)',
            border: '1px solid rgba(74, 58, 52, 0.14)',
            boxShadow: 'inset 0 1px 3px rgba(46, 37, 34, 0.10)',
            overflow: 'visible',
          }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label={`${label} ${Math.round(pct)}%`}
        >
          {/* Target benchmark notch indicator */}
          <div
            style={{
              position: 'absolute',
              top: -3,
              bottom: -3,
              left: `${targetPct}%`,
              width: 2,
              background: 'rgba(74, 58, 52, 0.35)',
              zIndex: 3,
              borderRadius: 1,
            }}
            title="Target 100%"
          />

          {/* Progress fill */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${clampedPct}%` }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 90, damping: 18, delay }
              }
              style={{
                height: '100%',
                background: gradientFill,
                borderRadius: 999,
                boxShadow: `0 0 10px -2px ${color}88`,
                position: 'relative',
              }}
            >
              {/* Glossy top highlight */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '40%',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 100%)',
                  borderRadius: 999,
                }}
              />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </LocalizedContent>
  );
}
