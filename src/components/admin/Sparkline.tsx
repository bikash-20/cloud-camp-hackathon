import { motion, useReducedMotion } from 'framer-motion';
import { useLanguage } from '../../i18n/LanguageContext';
import { toBengaliDigits } from '../../lib/format';

interface SparklineProps {
  /** One value per bar. Bars auto-scale to the max value. */
  values: number[];
  /** Optional labels rendered under each bar (e.g. day-of-week short). */
  labels?: string[];
  /** Container height in px. */
  height?: number;
  /** Tooltip-friendly accessible label. */
  ariaLabel?: string;
}

/**
 * Responsive bar chart for the admin Overview's "7-day meals" panel.
 * Uses flexbox and HTML typography to prevent SVG text scaling squashing.
 */
export default function Sparkline({
  values,
  labels = [],
  height = 140,
  ariaLabel,
}: SparklineProps) {
  const reduceMotion = useReducedMotion();
  const { language } = useLanguage();
  const isBn = language === 'bn';
  const max = Math.max(1, ...values);

  return (
    <div
      role="region"
      aria-label={ariaLabel ?? '7-day meal volume chart'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        paddingTop: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 8,
          height: height - 28,
          width: '100%',
          paddingBottom: 4,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {values.map((v, i) => {
          const ratio = Math.max(0.04, v / max);
          const barHeightPercent = Math.round(ratio * 100);
          const dayLabel = labels[i] ?? `Day ${i + 1}`;
          const formattedVal = isBn ? toBengaliDigits(v) : v;

          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
                position: 'relative',
              }}
              title={`${dayLabel}: ${v} meals`}
            >
              {v > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'rgba(249, 242, 228, 0.85)',
                    marginBottom: 4,
                  }}
                >
                  {formattedVal}
                </span>
              )}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${barHeightPercent}%` }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        type: 'spring',
                        stiffness: 260,
                        damping: 24,
                        delay: 0.04 * i,
                      }
                }
                style={{
                  width: '100%',
                  maxWidth: 32,
                  minWidth: 12,
                  borderRadius: '6px 6px 2px 2px',
                  background:
                    v > 0
                      ? 'linear-gradient(180deg, #F9F2E4 0%, #D0AE92 60%, #A8836C 100%)'
                      : 'rgba(255, 255, 255, 0.05)',
                  boxShadow:
                    v > 0
                      ? '0 2px 8px rgba(208, 174, 146, 0.25)'
                      : 'none',
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          marginTop: 8,
          width: '100%',
        }}
      >
        {labels.map((lab, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(249, 242, 228, 0.65)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {lab}
          </div>
        ))}
      </div>
    </div>
  );
}
