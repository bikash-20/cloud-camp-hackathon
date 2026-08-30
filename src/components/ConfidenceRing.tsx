import { motion, useReducedMotion } from 'framer-motion';
import { T } from '../data';

interface ConfidenceRingProps {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  delay?: number;
  children?: React.ReactNode;
}

/**
 * Animated SVG ring with spring-physics fill.
 */
export default function ConfidenceRing({
  value,
  size = 44,
  stroke = 4,
  color,
  delay = 0,
  children,
}: ConfidenceRingProps) {
  const reduceMotion = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
      }}
      aria-hidden={typeof children === 'string' ? undefined : 'true'}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(34, 48, 46, 0.14)"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color || T.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (clamped / 100) * c }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 80, damping: 18, delay }
          }
          style={{ filter: `drop-shadow(0 1px 2px ${(color || T.accent)}55)` }}
        />
      </svg>
      <div
        className="tnum"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: size * 0.24,
          fontWeight: 600,
          color: T.ink,
          textShadow: '0 1px 0 rgba(255,255,255,0.5)',
        }}
      >
        {children}
      </div>
    </div>
  );
}