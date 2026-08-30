import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Flame } from 'lucide-react';
import { T } from '../data';
import useCountUp from './useCountUp';

interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface SummaryCardProps {
  totals: Totals;
  itemCount: number;
}

/**
 * Sticky header summary card for the Results screen.
 */
export default function SummaryCard({ totals, itemCount }: SummaryCardProps) {
  const [open, setOpen] = useState(true);
  const kcal = useCountUp(Math.round(totals.kcal));
  const protein = useCountUp(Math.round(totals.protein));
  const carbs = useCountUp(Math.round(totals.carbs));
  const fat = useCountUp(Math.round(totals.fat));

  const macros = [
    { label: 'Protein', value: Math.round(protein), color: T.primary, pct: Math.min(100, Math.round((totals.protein / 50) * 100)) },
    { label: 'Carbs',   value: Math.round(carbs),   color: T.accentAmber, pct: Math.min(100, Math.round((totals.carbs / 80) * 100)) },
    { label: 'Fat',     value: Math.round(fat),     color: T.accentGood, pct: Math.min(100, Math.round((totals.fat / 65) * 100)) },
  ];

  return (
    <motion.div
      layout
      className="glass-card"
      style={{
        borderRadius: 18,
        padding: open ? '12px 14px' : '10px 14px',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: 600,
              color: T.ink,
              whiteSpace: 'nowrap',
            }}
          >
            🍽️ {itemCount} item{itemCount === 1 ? '' : 's'}
          </div>
          <span style={{ color: T.inkMuted, fontSize: 12 }}>·</span>
          <span
            className="kcal-chip"
            style={{ fontSize: 12, padding: '3px 8px' }}
          >
            <Flame size={11} /> {Math.round(kcal)} kcal
          </span>
        </div>
        <motion.button
          type="button"
          onClick={() => setOpen((v) => !v)}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          aria-label={open ? 'Collapse summary' : 'Expand summary'}
          aria-expanded={open}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(249, 242, 228, 0.6)',
            border: '1px solid rgba(74, 58, 52, 0.15)',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.span
            animate={{ rotate: open ? 0 : 180 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'inline-flex', color: T.inkSoft }}
          >
            <ChevronDown size={14} />
          </motion.span>
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden', marginTop: 10 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {macros.map((m) => (
                <div
                  key={m.label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 44px',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'Inter',
                      fontSize: 11,
                      fontWeight: 600,
                      color: T.ink,
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: 'rgba(74, 58, 52, 0.10)',
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${m.pct}%` }}
                      transition={{ type: 'spring', stiffness: 100, damping: 18 }}
                      style={{
                        height: '100%',
                        background: m.color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <div
                    className="tnum"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      color: T.ink,
                      textAlign: 'right',
                    }}
                  >
                    {m.value}g
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}