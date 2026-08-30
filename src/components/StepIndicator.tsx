import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { T, STEP_LABELS } from '../data';

interface StepIndicatorProps {
  step: number;
  onStep?: (i: number) => void;
}

/** 3-step horizontal indicator (Review → Adjust → Confirm). */
export default function StepIndicator({ step, onStep }: StepIndicatorProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 0 2px',
      }}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={STEP_LABELS.length}
      aria-valuenow={step + 1}
      aria-label={`Step ${step + 1} of ${STEP_LABELS.length}: ${STEP_LABELS[step]}`}
    >
      {STEP_LABELS.map((label, i) => {
        const done = i < step;
        const current = i === step;

        return (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flex: i === STEP_LABELS.length - 1 ? '0 0 auto' : 1,
              minWidth: 0,
            }}
          >
            <motion.button
              type="button"
              onClick={() => onStep?.(i)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label={`Go to step ${i + 1}: ${label}`}
              style={{
                position: 'relative',
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                background: done || current ? T.primary : 'rgba(249, 242, 228, 0.8)',
                boxShadow: current
                  ? `0 4px 10px -3px ${T.primary}66, inset 0 1px 0 rgba(255,255,255,0.4)`
                  : 'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(46,37,34,0.1)',
              }}
            >
              {done ? (
                <Check size={12} color="#FFFFFF" strokeWidth={3} />
              ) : (
                <span
                  style={{
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: 700,
                    color: current ? '#FFFFFF' : T.inkSoft,
                  }}
                >
                  {i + 1}
                </span>
              )}
            </motion.button>
            <span
              style={{
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: current ? 600 : 500,
                color: current ? T.ink : T.inkSoft,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {label}
            </span>

            {i < STEP_LABELS.length - 1 && (
              <motion.span
                animate={{ opacity: done ? 1 : 0.35 }}
                transition={{ duration: 0.2 }}
                style={{
                  flex: 1,
                  height: 1.5,
                  borderRadius: 1,
                  background: done ? T.primary : 'rgba(74, 58, 52, 0.20)',
                  marginLeft: 2,
                  marginRight: 4,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}