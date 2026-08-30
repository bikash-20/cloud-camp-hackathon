import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  /** Optional small caption under the value (e.g. "across 12 users"). */
  hint?: string;
  /** Optional delta vs previous period. Positive = green, negative = warn. */
  deltaPct?: number;
  /** Icon shown top-right in muted color. */
  icon?: React.ReactNode;
}

/**
 * Single stat card for the admin Overview. Used 4× in the KPI row.
 *
 * Intentionally compact — admin pages need many stats, not big hero
 * numbers. The animated entrance is staggered by the parent.
 */
export default function KpiCard({ label, value, hint, deltaPct, icon }: KpiCardProps) {
  const reduceMotion = useReducedMotion();
  const deltaIsPositive = typeof deltaPct === 'number' && deltaPct >= 0;
  const deltaIsFlat = typeof deltaPct === 'number' && Math.abs(deltaPct) < 0.5;

  return (
    <motion.div
      whileHover={reduceMotion ? {} : { y: -2 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: 700,
            color: 'rgba(249, 242, 228, 0.55)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            aria-hidden="true"
            style={{
              color: 'rgba(249, 242, 228, 0.40)',
              display: 'inline-flex',
            }}
          >
            {icon}
          </span>
        )}
      </div>

      <div
        className="tnum"
        style={{
          fontFamily: 'Inter',
          fontSize: 32,
          fontWeight: 700,
          color: '#F9F2E4',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {typeof deltaPct === 'number' && !deltaIsFlat && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              padding: '2px 8px',
              borderRadius: 999,
              background: deltaIsPositive
                ? 'rgba(122, 140, 79, 0.18)'
                : 'rgba(201, 98, 45, 0.18)',
              color: deltaIsPositive ? '#B8C68A' : '#F0B79A',
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: 700,
            }}
            aria-label={`${deltaIsPositive ? 'up' : 'down'} ${Math.abs(deltaPct).toFixed(1)}% vs previous period`}
          >
            {deltaIsPositive ? (
              <ArrowUpRight size={11} strokeWidth={2.5} />
            ) : (
              <ArrowDownRight size={11} strokeWidth={2.5} />
            )}
            {Math.abs(deltaPct).toFixed(1)}%
          </span>
        )}
        {hint && (
          <span
            style={{
              fontFamily: 'Inter',
              fontSize: 11,
              color: 'rgba(249, 242, 228, 0.55)',
              lineHeight: 1.3,
            }}
          >
            {hint}
          </span>
        )}
      </div>
    </motion.div>
  );
}