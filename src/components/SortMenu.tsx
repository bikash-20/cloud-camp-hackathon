import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpDown, Check } from 'lucide-react';
import { T } from '../data';

export const SORT_OPTIONS: Array<{ key: 'conf' | 'kcal' | 'grams' | 'name'; label: string }> = [
  { key: 'conf',  label: 'By Confidence' },
  { key: 'kcal',  label: 'By Calories (high → low)' },
  { key: 'grams', label: 'By Portion Size' },
  { key: 'name',  label: 'Alphabetical' },
];

interface SortMenuProps {
  value: 'conf' | 'kcal' | 'grams' | 'name';
  onChange: (key: 'conf' | 'kcal' | 'grams' | 'name') => void;
}

/** Sort dropdown. Anchored popover menu that closes on outside click / Escape. */
export default function SortMenu({ value, onChange }: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.key === value) ?? SORT_OPTIONS[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Sort: ${current.label}. Tap to change.`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: 'rgba(249, 242, 228, 0.75)',
          border: '1px solid rgba(74, 58, 52, 0.15)',
          borderRadius: 14,
          padding: '5px 10px',
          fontFamily: 'Inter',
          fontSize: 11.5,
          fontWeight: 600,
          color: T.ink,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          minHeight: 32,
        }}
      >
        <ArrowUpDown size={11} color={T.inkSoft} />
        Sort: {current.label.split(' (')[0]}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="glass-card"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              zIndex: 10,
              listStyle: 'none',
              margin: 0,
              padding: 4,
              borderRadius: 14,
              minWidth: 220,
              boxShadow: '0 12px 28px -10px rgba(46, 37, 34, 0.30)',
            }}
          >
            {SORT_OPTIONS.map((opt) => {
              const active = opt.key === value;
              return (
                <li key={opt.key} role="none" style={{ listStyle: 'none' }}>
                  <motion.button
                    role="menuitemradio"
                    aria-checked={active}
                    type="button"
                    onClick={() => {
                      onChange(opt.key);
                      setOpen(false);
                    }}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      background: active ? 'rgba(74, 58, 52, 0.08)' : 'transparent',
                      border: 'none',
                      padding: '8px 10px',
                      borderRadius: 10,
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: active ? 600 : 500,
                      color: T.ink,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>{opt.label}</span>
                    {active && <Check size={12} color={T.primary} strokeWidth={3} />}
                  </motion.button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}