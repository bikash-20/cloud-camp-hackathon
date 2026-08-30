import { motion, useReducedMotion } from 'framer-motion';
import { T } from '../data';

interface BarProps {
  label: string;
  pct: number;
  color: string;
  sub?: string;
  delay?: number;
}

/** Animated progress bar with label + value subtext. */
export default function Bar({ label, pct, color, sub, delay = 0 }: BarProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      style={{ marginBottom: 12 }}
      whileHover={{ x: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'Inter',
          fontSize: 12,
          marginBottom: 6,
        }}
      >
        <span style={{ fontWeight: 600, color: T.ink }}>{label}</span>
        <span
          className="tnum"
          style={{
            fontFamily: "'Inter', sans-serif",
            color: T.inkSoft,
            fontSize: 11,
          }}
        >
          {sub}
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: 'rgba(74, 58, 52, 0.08)',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.4)',
          boxShadow: 'inset 0 1px 2px rgba(46, 37, 34, 0.08)',
        }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`${label} ${Math.round(pct)}%`}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 80, damping: 18, delay }
          }
          style={{
            height: '100%',
            background: color,
            borderRadius: 4,
            boxShadow: `0 0 12px -2px ${color}88, inset 0 1px 0 rgba(255,255,255,0.4)`,
          }}
        />
      </div>
    </motion.div>
  );
}