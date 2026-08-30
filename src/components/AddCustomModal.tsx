import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { T } from '../data';

type Mode = 'add' | 'rename';

interface AddCustomModalProps {
  open: boolean;
  mode?: Mode;
  onClose: () => void;
  onSubmit: (name: string, grams: number) => void;
  /** Names already in the list — used to detect duplicates (ignored in rename mode) */
  existingNames?: string[];
  /** Default name to pre-fill the input */
  defaultName?: string;
  /** Default grams to pre-fill */
  defaultGrams?: number;
}

/**
 * Inline modal for adding or renaming a food item in the Results screen.
 *
 * Replaces `window.prompt()` which:
 *   - Is blocked in many desktop browsers (Chrome 92+, embedded webviews)
 *   - Doesn't match the app's design language
 *   - Doesn't work in PWA / cross-origin contexts
 *
 * Renders a glass-card sheet anchored to the screen with a backdrop, focus
 * trap (basic), Esc-to-close, Enter-to-submit, and shake-on-error feedback
 * matching the AddItemForm pattern from GroceryScreen.
 *
 * Modes:
 *   - 'add' (default): collects name + grams, validates against existingNames
 *   - 'rename': collects name only (grams hidden), allows same name on submit
 */
export default function AddCustomModal({
  open,
  mode = 'add',
  onClose,
  onSubmit,
  existingNames = [],
  defaultName = '',
  defaultGrams = 60,
}: AddCustomModalProps) {
  const reduceMotion = useReducedMotion();
  const [name, setName] = useState(defaultName);
  const [grams, setGrams] = useState(defaultGrams);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  const title = mode === 'rename' ? 'Rename item' : 'Add custom item';
  const submitLabel = mode === 'rename' ? 'Save' : 'Add';

  // Reset state when the modal opens
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setGrams(defaultGrams);
      setError(null);
    }
  }, [open, defaultName, defaultGrams]);

  // Autofocus the name input when the modal opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        nameRef.current?.focus();
        // For rename, select all so the user can immediately type a new name
        if (mode === 'rename') nameRef.current?.select();
      }, 80);
      return () => clearTimeout(t);
    }
  }, [open, mode]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(mode === 'rename' ? 'Name cannot be empty' : 'Please enter an item name');
      setShake((n) => n + 1);
      nameRef.current?.focus();
      return;
    }
    // In rename mode, allow same name (no-op rename is fine; it's the user's call)
    if (mode === 'add' && existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      setError(`${trimmed} is already in the list`);
      setShake((n) => n + 1);
      nameRef.current?.focus();
      return;
    }
    const g = mode === 'rename'
      ? defaultGrams
      : Math.max(5, Math.min(800, Math.round(Number(grams) || defaultGrams)));
    onSubmit(trimmed, g);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — bounded by the phone frame via position: absolute,
              NOT position: fixed. Fixed would expand to the viewport width
              and overflow the 360px phone-frame bezel on desktop browsers.
              Absolute resolves to the nearest positioned ancestor, which is
              the PhoneFrame container in both the mobile (full-bleed) and
              desktop (bezel) branches. */}
          <motion.div
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(46, 37, 34, 0.35)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              zIndex: 100,
            }}
          />

          {/* Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-custom-title"
            aria-describedby={error ? 'add-custom-error' : 'add-custom-hint'}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={
              error
                ? { opacity: 1, y: 0, scale: 1, x: [0, -6, 6, -4, 4, 0] }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26, x: { duration: 0.35 } }}
            key={`shake-${shake}`}
            className="glass-card"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 32px)',
              maxWidth: 320,
              boxSizing: 'border-box',
              borderRadius: 20,
              padding: '20px 18px 18px',
              boxShadow:
                '0 24px 60px -16px rgba(46, 37, 34, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
              zIndex: 101,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3
                id="add-custom-title"
                style={{
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: 600,
                  color: T.ink,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                {title}
              </h3>
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                aria-label="Close"
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

            {/* Name input */}
            <div>
              <label
                htmlFor="add-custom-name"
                style={{
                  fontFamily: 'Inter',
                  fontSize: 10,
                  fontWeight: 600,
                  color: T.inkSoft,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Item name
              </label>
              <input
                id="add-custom-name"
                ref={nameRef}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                placeholder={mode === 'rename' ? 'New name' : 'e.g. Naan, Yogurt, Pickle'}
                aria-invalid={!!error}
                autoComplete="off"
                className="tnum"
                style={{
                  width: '100%',
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: 500,
                  color: T.ink,
                  background: 'rgba(249, 242, 228, 0.7)',
                  border: `1px solid ${error ? T.accentWarn : 'rgba(74, 58, 52, 0.20)'}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Grams input — hidden in rename mode */}
            {mode === 'add' && (
              <div>
                <label
                  htmlFor="add-custom-grams"
                  style={{
                    fontFamily: 'Inter',
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.inkSoft,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Portion (grams)
                </label>
                <input
                  id="add-custom-grams"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={800}
                  value={grams}
                  onChange={(e) => setGrams(Number(e.target.value || 0))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                  aria-label="Portion in grams"
                  className="tnum"
                  style={{
                    width: 120,
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: 600,
                    color: T.ink,
                    background: 'rgba(249, 242, 228, 0.7)',
                    border: '1px solid rgba(74, 58, 52, 0.20)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    outline: 'none',
                    textAlign: 'right',
                  }}
                />
              </div>
            )}

            {/* Error / hint */}
            {error ? (
              <div
                id="add-custom-error"
                role="alert"
                aria-live="assertive"
                style={{
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.accentWarn,
                  marginTop: -4,
                }}
              >
                {error}
              </div>
            ) : (
              <div
                id="add-custom-hint"
                style={{
                  fontFamily: 'Inter',
                  fontSize: 11,
                  color: T.inkMuted,
                  marginTop: -4,
                  lineHeight: 1.4,
                }}
              >
                {mode === 'rename'
                  ? 'Enter a new name for this item. Press Enter to save.'
                  : 'We\u2019ll estimate nutrition for this item once it\u2019s added. Press Enter to confirm.'}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                style={{
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '10px 16px',
                  borderRadius: 12,
                  border: '1px solid rgba(74, 58, 52, 0.20)',
                  background: 'transparent',
                  color: T.ink,
                  cursor: 'pointer',
                  minHeight: 40,
                }}
              >
                Cancel
              </motion.button>
              <motion.button
                type="button"
                onClick={submit}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '10px 18px',
                  borderRadius: 12,
                  border: 'none',
                  background: T.primary,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  minHeight: 40,
                  boxShadow: `0 6px 14px -4px ${T.primary}66`,
                }}
              >
                <Check size={14} strokeWidth={2.5} /> {submitLabel}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}