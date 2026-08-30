import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine } from 'lucide-react';
import { T } from '../data';

/**
 * Sticky top-right circular thumbnail of the captured photo (placeholder).
 */
export default function PhotoThumb() {
  const [pulsing, setPulsing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const onTap = () => {
    setPulsing(true);
    setExpanded(true);
    setTimeout(() => setPulsing(false), 800);
    setTimeout(() => setExpanded(false), 1400);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 12,
        zIndex: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <AnimatePresence>
        {expanded && (
          <motion.span
            key="cap"
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.2 }}
            style={{
              fontFamily: 'Inter',
              fontSize: 10,
              fontWeight: 600,
              color: T.ink,
              background: 'rgba(249, 242, 228, 0.92)',
              padding: '4px 8px',
              borderRadius: 8,
              boxShadow: '0 4px 10px -4px rgba(46, 37, 34, 0.25)',
            }}
          >
            chicken_biryani.jpg
          </motion.span>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={onTap}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        aria-label="View captured photo"
        style={{
          position: 'relative',
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          background:
            'linear-gradient(160deg, rgba(74, 58, 52, 0.95), rgba(46, 37, 34, 0.98))',
          boxShadow:
            '0 6px 14px -4px rgba(46, 37, 34, 0.45), inset 0 1.5px 0 rgba(255, 255, 255, 0.15)',
          overflow: 'visible',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 4,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 50% 45%, rgba(249, 242, 228, 0.30), transparent 60%)',
          }}
        />
        <span
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'inline-flex',
            color: T.earth6,
          }}
        >
          <ScanLine size={18} strokeWidth={1.8} />
        </span>

        {pulsing && (
          <motion.span
            aria-hidden="true"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.8 }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid rgba(249, 242, 228, 0.7)',
            }}
          />
        )}
      </motion.button>
    </div>
  );
}