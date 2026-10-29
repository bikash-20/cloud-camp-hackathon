import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, Edit3, X, Sparkles } from 'lucide-react';
import { T } from '../data';
import { LocalizedContent, useLanguage } from '../i18n/LanguageContext';

interface SmartActionSheetProps {
  open: boolean;
  onViewNutrients?: () => void;
  onEditMeal?: () => void;
  onDiscard?: () => void;
  onClose?: () => void;
}

/**
 * Bottom action sheet shown after all items are confirmed.
 */
export default function SmartActionSheet({
  open,
  onViewNutrients,
  onEditMeal,
  onDiscard,
  onClose,
}: SmartActionSheetProps) {
  const { language } = useLanguage();
  const isBn = language === 'bn';
  return (
    <LocalizedContent>
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(46, 37, 34, 0.35)',
              zIndex: 6,
            }}
            aria-hidden="true"
          />
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            className="glass-card"
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 100,
              zIndex: 7,
              borderRadius: 24,
              padding: '18px 18px 16px',
              boxShadow: '0 -10px 32px -10px rgba(46, 37, 34, 0.40)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.05 }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: T.accentGood,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                </motion.span>
                <h3
                  id="sheet-title"
                  style={{
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: 600,
                    color: T.ink,
                    margin: 0,
                  }}
                >
                  {isBn ? 'সব খাবার নিশ্চিত করা হয়েছে!' : 'All items confirmed!'}
                </h3>
              </div>
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
                style={{
                  width: 28,
                  height: 28,
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

            <p
              style={{
                fontFamily: 'Inter',
                fontSize: 12,
                color: T.inkSoft,
                margin: '0 0 14px',
                lineHeight: 1.4,
              }}
            >
              {isBn
                ? 'আপনার খাবার প্রস্তুত। সম্পূর্ণ পুষ্টি বিশ্লেষণ দেখুন বা সমন্বয় করুন।'
                : 'Your meal is ready. See the full nutrient breakdown or make final tweaks.'}
            </p>

            <motion.button
              type="button"
              onClick={onViewNutrients}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label={isBn ? 'এই খাবারের পুষ্টি বিশ্লেষণ দেখুন' : 'View nutrients for this meal'}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 14px',
                borderRadius: 14,
                background: T.primary,
                border: 'none',
                color: '#FFFFFF',
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: 10,
                boxShadow: `0 8px 18px -6px ${T.primary}66`,
              }}
            >
              <Sparkles size={14} /> {isBn ? 'পুষ্টি বিশ্লেষণ দেখুন' : 'View Nutrients'}
              <ArrowRight size={14} />
            </motion.button>

            <motion.button
              type="button"
              onClick={onEditMeal}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label={isBn ? 'সংরক্ষণ করার আগে খাবার সম্পাদনা করুন' : 'Edit meal before saving'}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 14,
                background: 'rgba(249, 242, 228, 0.85)',
                border: '1px solid rgba(74, 58, 52, 0.18)',
                color: T.ink,
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: 8,
              }}
            >
              <Edit3 size={12} /> {isBn ? 'খাবার সম্পাদনা' : 'Edit Meal'}
            </motion.button>

            <motion.button
              type="button"
              onClick={onDiscard}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label={isBn ? 'এই খাবার বাতিল করুন' : 'Discard this meal'}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: T.inkSoft,
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 0',
              }}
            >
              {isBn ? 'বাতিল করুন' : 'Discard'}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </LocalizedContent>
  );
}