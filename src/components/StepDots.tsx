import { motion } from 'framer-motion';
import { T, TABS } from '../data';

interface StepDotsProps {
  active: number;
  onChange?: (i: number) => void;
}

/**
 * Pagination pill dots for the header.
 */
export default function StepDots({ active, onChange }: StepDotsProps) {
  return (
    <div
      style={{ display: 'flex', gap: 5, alignItems: 'center' }}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={TABS.length}
      aria-valuenow={active + 1}
      aria-label={`Step ${active + 1} of ${TABS.length}`}
    >
      {TABS.map((t, i) => {
        const isActive = i === active;
        return (
          <motion.button
            key={t.id}
            type="button"
            aria-label={`Go to ${t.label}`}
            onClick={() => onChange?.(i)}
            whileHover={!isActive ? { scale: 1.15 } : {}}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.div
              initial={false}
              animate={{
                width: isActive ? 20 : 8,
                backgroundColor: isActive ? T.earth6 : 'rgba(249, 242, 228, 0.45)',
              }}
              whileHover={
                !isActive
                  ? { backgroundColor: 'rgba(249, 242, 228, 0.85)' }
                  : {}
              }
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              style={{
                height: 4,
                borderRadius: 2,
              }}
            />

            {!isActive && (
              <motion.span
                aria-hidden="true"
                initial={{ opacity: 0, y: 6 }}
                whileHover={{ opacity: 1, y: 0 }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: 'rgba(46, 37, 34, 0.92)',
                  color: '#FFFFFF',
                  fontFamily: 'Inter',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                {t.label}
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}