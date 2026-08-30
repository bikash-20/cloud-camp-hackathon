import { motion } from 'framer-motion';
import { Check, Eye, Plus, X } from 'lucide-react';
import { T } from '../data';

interface BulkActionBarProps {
  count: number;
  onConfirmAll?: () => void;
  onReviewAll?: () => void;
  onAddCustom?: () => void;
  onCancel?: () => void;
  hasHighConf?: boolean;
}

/** Sticky bottom action bar shown when 1+ items are selected. */
export default function BulkActionBar({
  count,
  onConfirmAll,
  onReviewAll,
  onAddCustom,
  onCancel,
  hasHighConf,
}: BulkActionBarProps) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="glass-card"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 100,
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 22,
        boxShadow: '0 12px 28px -10px rgba(46, 37, 34, 0.30)',
      }}
      role="toolbar"
      aria-label="Bulk actions"
    >
      <div
        style={{
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: 600,
          color: T.ink,
          paddingLeft: 4,
          paddingRight: 4,
          whiteSpace: 'nowrap',
        }}
      >
        {count} selected
      </div>

      <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
        {hasHighConf && (
          <motion.button
            type="button"
            onClick={onConfirmAll}
            whileHover={{ y: -1, scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            aria-label="Confirm all selected high-confidence items"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 999,
              background: T.accentGood,
              border: 'none',
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: 'pointer',
              minHeight: 32,
              boxShadow: `0 4px 10px -3px ${T.accentGood}66`,
            }}
          >
            <Check size={11} strokeWidth={3} /> Confirm
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={onReviewAll}
          whileHover={{ y: -1, scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          aria-label="Review all selected items"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'rgba(249, 242, 228, 0.8)',
            border: '1px solid rgba(74, 58, 52, 0.18)',
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: 600,
            color: T.ink,
            cursor: 'pointer',
            minHeight: 32,
          }}
        >
          <Eye size={11} /> Review
        </motion.button>

        <motion.button
          type="button"
          onClick={onAddCustom}
          whileHover={{ scale: 1.08, rotate: 90 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          aria-label="Add custom item"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: T.primary,
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            boxShadow: `0 4px 10px -3px ${T.primary}66`,
          }}
        >
          <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
        </motion.button>

        <motion.button
          type="button"
          onClick={onCancel}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          aria-label="Exit multi-select mode"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(74, 58, 52, 0.08)',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <X size={12} color={T.inkSoft} strokeWidth={2.5} />
        </motion.button>
      </div>
    </motion.div>
  );
}