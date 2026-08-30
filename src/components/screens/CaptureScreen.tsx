import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Camera, Sparkles, ScanLine, RotateCcw, X } from 'lucide-react';
import { T, USER_NAME } from '../../data';

interface CaptureScreenProps {
  onClick: () => void;
  onReset?: () => void;
  captured: boolean;
}

/**
 * Home / Capture screen — spec §4B + §4C.
 */
export default function CaptureScreen({ onClick, onReset, captured }: CaptureScreenProps) {
  const reduceMotion = useReducedMotion();
  const [rippling, setRippling] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  useEffect(() => {
    if (!captured) {
      setAnalyzeProgress(0);
      return;
    }
    if (reduceMotion) {
      setAnalyzeProgress(100);
      return;
    }
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1600);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnalyzeProgress(eased * 100);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [captured, reduceMotion]);

  const handleTap = () => {
    if (captured) return;
    setPressed(true);
    setRippling(true);
    setTimeout(() => setRippling(false), 600);
    setTimeout(() => setPressed(false), 200);
    onClick();
  };

  return (
    <div style={{ padding: '20px 24px 0' }}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: 500,
          color: T.inkSoft,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Good evening, {USER_NAME}
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        style={{
          fontFamily: 'Inter',
          fontSize: 36,
          fontWeight: 600,
          color: T.ink,
          margin: '8px 0 8px',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
        }}
      >
        Every bite has a story.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        style={{
          fontFamily: 'Inter',
          fontSize: 16,
          color: T.inkSoft,
          margin: '0 0 28px',
          lineHeight: 1.4,
        }}
      >
        Snap your plate — we'll do the rest.
      </motion.p>

      <motion.button
        type="button"
        onClick={handleTap}
        disabled={captured}
        aria-label={captured ? 'Photo captured, analyzing' : 'Tap to snap a photo'}
        whileHover={!captured && !reduceMotion ? { scale: 1.005 } : {}}
        whileTap={!captured && !reduceMotion ? { scale: 0.98 } : {}}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        className="glass-card"
        style={{
          all: 'unset',
          width: '100%',
          borderRadius: 24,
          aspectRatio: '4 / 3.5',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: captured ? 'default' : 'pointer',
          background: captured
            ? 'linear-gradient(160deg, #77574A, #4A3A34)'
            : T.cardBg,
          border: pressed || captured
            ? `2px solid ${T.primary}`
            : `2px dashed ${T.cardBorder}`,
          boxShadow: pressed || captured
            ? `0 14px 36px -14px rgba(46,37,34,0.55)`
            : '0 8px 32px rgba(46, 37, 34, 0.08)',
        }}
      >
        <AnimatePresence>
          {rippling && (
            <motion.span
              key="ripple"
              initial={{ width: 0, height: 0, opacity: 0.45 }}
              animate={{ width: 360, height: 360, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                borderRadius: '50%',
                background: T.primary,
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        {!captured ? (
          <div
            style={{
              textAlign: 'center',
              position: 'relative',
              padding: '0 20px',
            }}
          >
            <motion.div
              whileHover={!reduceMotion ? { scale: 1.04 } : {}}
              whileTap={!reduceMotion ? { scale: 0.92 } : {}}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: T.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                boxShadow: '0 8px 24px rgba(46, 37, 34, 0.25)',
              }}
            >
              <Camera size={26} color="#FFFFFF" strokeWidth={2} />
            </motion.div>
            <div
              style={{
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: 18,
                color: T.ink,
              }}
            >
              Tap to snap a photo
            </div>
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: 14,
                color: T.inkSoft,
                marginTop: 6,
              }}
            >
              Plate, ingredients, or a menu — all work
            </div>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 50% 45%, rgba(249, 242, 228, 0.22), transparent 60%)',
              }}
              aria-hidden="true"
            />

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              style={{
                position: 'absolute',
                bottom: 16,
                left: 18,
                color: 'rgba(249, 242, 228, 0.92)',
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              chicken_biryani.jpg
            </motion.div>

            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.1 }}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 56,
                height: 56,
              }}
            >
              <svg width={56} height={56} style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx={28}
                  cy={28}
                  r={24}
                  stroke="rgba(249, 242, 228, 0.25)"
                  strokeWidth={3}
                  fill="none"
                />
                <motion.circle
                  cx={28}
                  cy={28}
                  r={24}
                  stroke={T.earth6}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 24}
                  strokeDashoffset={2 * Math.PI * 24 * (1 - analyzeProgress / 100)}
                  style={{ transition: 'stroke-dashoffset 80ms linear' }}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ScanLine size={20} color={T.earth6} strokeWidth={1.8} />
              </div>
            </motion.div>

            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReset?.();
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label="Retake photo"
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(249, 242, 228, 0.18)',
                border: '1px solid rgba(249, 242, 228, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={16} color={T.earth6} strokeWidth={2} />
            </motion.button>
          </>
        )}
      </motion.button>

      <AnimatePresence mode="wait">
        {captured ? (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            role="status"
            aria-live="polite"
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'Inter',
              fontSize: 13,
              color: T.ink,
              fontWeight: 600,
            }}
          >
            <motion.span
              animate={reduceMotion ? {} : { rotate: [0, 360] }}
              transition={
                reduceMotion ? {} : { duration: 2, repeat: Infinity, ease: 'linear' }
              }
              style={{ display: 'inline-flex' }}
            >
              <Sparkles size={14} color={T.primary} />
            </motion.span>
            <span style={{ flex: 1 }}>Analyzing your plate…</span>
            <motion.button
              type="button"
              onClick={onReset}
              whileHover={{ x: 1 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label="Retake photo"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                padding: '4px 6px',
                color: T.primary,
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={12} /> Retake
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            style={{
              marginTop: 16,
              fontFamily: 'Inter',
              fontSize: 12,
              color: T.inkSoft,
              textAlign: 'center',
            }}
          >
            Tap anywhere in the card to capture
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}