import { motion, useReducedMotion } from 'framer-motion';

interface SparklineProps {
  /** One value per bar. Bars auto-scale to the max value. */
  values: number[];
  /** Optional labels rendered under each bar (e.g. day-of-week short). */
  labels?: string[];
  /** Bar fill — single color or gradient. Defaults to brand cream→amber. */
  fill?: string;
  /** Container height in px (bars themselves are computed). */
  height?: number;
  /** Tooltip-friendly hover label, e.g. "7 meals on Mon". */
  ariaLabel?: string;
}

/**
 * Tiny inline-SVG bar chart for the admin Overview's "7-day meals" panel.
 *
 * Bars are rendered as <rect>s inside a fixed-aspect <svg> so they scale
 * cleanly across responsive layouts. Animation: width grows from 0 to
 * final on mount via framer-motion.
 */
export default function Sparkline({
  values,
  labels,
  fill = 'url(#sparklineGradient)',
  height = 120,
  ariaLabel,
}: SparklineProps) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(1, ...values);
  const barCount = values.length;
  // Inline padding on the SVG so bars don't kiss the edges.
  const padX = 6;
  const padY = 8;
  const labelGutter = labels && labels.length > 0 ? 18 : 0;
  const usableW = 100 - padX * 2;
  const usableH = height - padY * 2 - labelGutter;
  const slot = barCount > 0 ? usableW / barCount : 0;
  const barW = Math.max(2, slot * 0.62);
  const gap = slot - barW;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel ?? `Bar chart with ${barCount} bars`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#F9F2E4" stopOpacity="0.95" />
          <stop offset="60%"  stopColor="#D0AE92" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#A8836C" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {values.map((v, i) => {
        const ratio = v / max;
        const h = Math.max(2, ratio * usableH);
        const x = padX + i * slot + gap / 2;
        const y = padY + (usableH - h);
        return (
          <motion.rect
            key={i}
            x={x}
            width={barW}
            initial={{ y: padY + usableH, height: 0 }}
            animate={{ y, height: h }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    type: 'spring',
                    stiffness: 220,
                    damping: 26,
                    delay: 0.05 * i,
                  }
            }
            rx={Math.min(2, barW / 2)}
            ry={Math.min(2, barW / 2)}
            fill={fill}
          >
            <title>{`${labels?.[i] ?? `Bar ${i + 1}`}: ${v}`}</title>
          </motion.rect>
        );
      })}

      {/* Labels under the bars */}
      {labels && labels.length > 0 && (
        <g>
          {labels.map((lab, i) => {
            const x = padX + i * slot + slot / 2;
            const y = padY + usableH + labelGutter - 4;
            return (
              <text
                key={`l-${i}`}
                x={x}
                y={y}
                textAnchor="middle"
                fontFamily="Inter, system-ui, sans-serif"
                fontSize={7}
                fontWeight={600}
                fill="rgba(249, 242, 228, 0.55)"
              >
                {lab}
              </text>
            );
          })}
        </g>
      )}
    </svg>
  );
}