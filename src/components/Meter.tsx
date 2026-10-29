import { motion, useReducedMotion } from 'framer-motion';
import { T } from '../data';
import { useLanguage } from '../i18n/LanguageContext';
import { toBengaliDigits } from '../lib/format';

interface MiniBarProps {
  /** 0..1, clamped at render time. */
  ratio: number;
  fill: string;
  height: number;
  delay?: number;
  ariaLabel?: string;
  /** Real-unit value for the bar (e.g. 800 kcal). When set, screen
   *  readers announce "800 of 2000" instead of the dimensionless ratio. */
  ariaValueNow?: number;
  /** Real-unit ceiling for the bar (e.g. 2000 kcal). */
  ariaValueMax?: number;
}

/** Tiny animated progress bar used by the daily-kcal bar and the macro
 *  mini-bars in Today's Summary. The existing `Bar` component is styled
 *  for the Nutrients screen (full label + subtext, drop-shadow, border)
 *  and doesn't fit the flatter Home aesthetic — so the meter family
 *  lives here instead.
 *
 *  Pass `ariaValueNow`/`ariaValueMax` as raw numbers when the bar
 *  represents a real unit (kcal, grams) — screen readers will then
 *  announce e.g. "800 of 2000" instead of the dimensionless ratio. */
export function MiniBar({
  ratio,
  fill,
  height,
  delay,
  ariaLabel,
  ariaValueNow,
  ariaValueMax,
}: MiniBarProps) {
  const reduceMotion = useReducedMotion();
  const pct = Math.min(1, Math.max(0, ratio));
  return (
    <div
      style={{
        position: 'relative',
        height,
        borderRadius: 999,
        background: 'rgba(74, 58, 52, 0.10)',
        overflow: 'hidden',
      }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={ariaValueMax ?? 1}
      aria-valuenow={ariaValueNow ?? pct}
      aria-label={ariaLabel}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct * 100}%` }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 180, damping: 26, delay }
        }
        style={{
          position: 'absolute',
          inset: 0,
          background: fill,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

const METER_LABEL_STYLE = {
  fontFamily: 'Inter',
  fontSize: 11,
  fontWeight: 600,
  color: T.inkSoft,
  letterSpacing: '0.02em',
} as const;

const METER_VALUE_STYLE = {
  fontFamily: 'Inter',
  fontSize: 11,
  fontWeight: 600,
} as const;

interface MacroMeterProps {
  label: string;
  current: number;
  target: number;
  /** "g" or "mg" — printed after the rounded current value. */
  unit: 'g' | 'mg';
  /** Bar color used when current ≤ target. */
  color: string;
  height?: number;
  delay?: number;
}

/** A labeled ratio bar — encapsulates the "over-target" styling so
 *  call sites only pass current + target. */
export function MacroMeter({
  label,
  current,
  target,
  unit,
  color,
  height = 4,
  delay = 0,
}: MacroMeterProps) {
  const { language } = useLanguage();
  const isBn = language === 'bn';
  const ratio = current / Math.max(1, target);
  const over = ratio > 1;
  const fill = over
    ? `linear-gradient(90deg, ${T.accentWarn}, ${T.accentAmber})`
    : color;
  const displayUnit = isBn ? (unit === 'g' ? ' গ্রাম' : ' মিগ্রা') : unit;
  const displayVal = isBn ? toBengaliDigits(Math.round(current)) : Math.round(current);
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
        }}
      >
        <span style={METER_LABEL_STYLE}>{label}</span>
        <span
          className="tnum"
          style={{ ...METER_VALUE_STYLE, color: over ? T.accentWarn : T.inkSoft }}
        >
          {displayVal}{displayUnit}
        </span>
      </div>
      <MiniBar
        ratio={ratio}
        fill={fill}
        height={height}
        delay={delay}
        ariaLabel={isBn ? `${label} অগ্রগতি` : `${label} progress`}
      />
    </div>
  );
}
