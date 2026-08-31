import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Camera, Sparkles, ScanLine, RotateCcw, X, Upload, UtensilsCrossed, History, ShoppingBag, ChevronRight } from 'lucide-react';
import { T, USER_NAME, getGreeting, NUTRITION_DB } from '../../data';
import { getTodaySummary, getMealHistory, getMacroTargets } from '../../lib/api';
import type { MealEntry, TodaySummary } from '../../types/schemas';

type CapturePhase = 'idle' | 'camera' | 'captured';

/** Tab indices match the order in src/mocks/fixtures.ts → MOCK_TABS. Kept
 *  here as a local mapping so we don't have to import the whole TABS array
 *  just to call `goToTab` from a quick-action chip. Only Grocery needs an
 *  index here today — Recent scrolls within the screen, Log Meal opens the
 *  camera card. If we add cross-tab navigation from Capture later, list it
 *  here. */
const TAB_GROCERY = 4;

interface CaptureScreenProps {
  /** Called with the captured image data URL when the user takes a photo. */
  onCapture?: (dataUrl: string) => void;
  /** Legacy: called to trigger the analysis pipeline. */
  onClick: () => void;
  onReset?: () => void;
  captured: boolean;
  /** Optional preview URL to show after capture (e.g. from parent state). */
  previewUrl?: string | null;
  /** Optional callback to switch tabs (used by quick-action chips). */
  onNavigateTab?: (index: number) => void;
}

/** Format an ISO timestamp as a short relative string for the recent-meals
 *  list. We deliberately drop absolute time for the most-recent entries and
 *  fall back to "Yesterday" / weekday for older ones — phone-first UX, not a
 *  desktop dashboard.
 *
 *    < 1 min   → "just now"
 *    < 60 min  → "Nm ago"
 *    same day  → "Nh ago"
 *    −1 day    → "Yesterday"
 *    < 7 d     → weekday short
 *    else      → "Mon DD"
 *
 *  Bug note: we used to gate the "Nh ago" branch on
 *  `now.toDateString() === then.toDateString()`, which is wrong for a meal
 *  logged at 23:50 and viewed at 00:30 (diffH is 1 but they're different
 *  calendar days). The fix: compute diffH *first*, then fall through to
 *  the calendar-comparison branches only when diffH ≥ 24.
 */
function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const dayDiff = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return then.toLocaleDateString([], { weekday: 'short' });
  return then.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Hash a string into a stable integer 0..2^31. Used to deterministically
 *  pick a gradient stop pair for meals that don't have a captured photo. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Pick a deterministic gradient + emoji fallback for a meal thumbnail when
 *  there's no captured image. Tied to the meal.id so the same meal always
 *  renders the same swatch — important so the list feels stable across
 *  re-renders. The emoji is the descriptor's emoji for the first item that
 *  has one; falls back to a fork-and-knife glyph. */
function pickThumbnailStyle(meal: MealEntry, descriptorEmojis: Record<string, string>) {
  const h = hashStr(meal.id);
  // Warm earth-tone gradients that read well on the cream card bg.
  const palettes = [
    'linear-gradient(135deg, #D0AE92, #A8836C)',
    'linear-gradient(135deg, #B8C68A, #7A8C4F)',
    'linear-gradient(135deg, #EBD7BE, #C9622D)',
    'linear-gradient(135deg, #A8836C, #77574A)',
  ];
  const bg = palettes[h % palettes.length];
  const firstItem = meal.items[0];
  const emoji = (firstItem && descriptorEmojis[firstItem.name]) || '🍽';
  return { bg, emoji };
}

/** Tiny animated progress bar used by both the daily-kcal bar and the three
 *  macro mini-bars. Kept local to this file because the existing `Bar`
 *  component is styled for the Nutrients screen (full label + subtext,
 *  drop-shadow, border) and doesn't fit the flatter Home aesthetic.
 *
 *  Pass `ariaValueNow`/`ariaValueMax` as raw numbers when the bar
 *  represents a real unit (kcal, grams) — screen readers will then
 *  announce e.g. "800 of 2000" instead of the dimensionless ratio. */
function MiniBar({
  ratio,
  fill,
  height,
  delay,
  ariaLabel,
  ariaValueNow,
  ariaValueMax,
}: {
  ratio: number;
  fill: string;
  height: number;
  delay?: number;
  ariaLabel?: string;
  ariaValueNow?: number;
  ariaValueMax?: number;
}) {
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

/**
 * A labeled ratio bar — used by both the daily-kcal bar and the three
 * macro mini-bars in Today's Summary. Encapsulates the "over-target"
 * styling so the call sites only pass current + target.
 */
function MacroMeter({
  label,
  current,
  target,
  unit,
  color,
  height = 4,
  delay = 0,
}: {
  label: string;
  current: number;
  target: number;
  /** "g" or "mg" — printed after the rounded current value. */
  unit: 'g' | 'mg';
  /** Bar color used when current ≤ target. */
  color: string;
  height?: number;
  delay?: number;
}) {
  const ratio = current / Math.max(1, target);
  const over = ratio > 1;
  const fill = over
    ? `linear-gradient(90deg, ${T.accentWarn}, ${T.accentAmber})`
    : color;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={METER_LABEL_STYLE}>{label}</span>
        <span className="tnum" style={{ ...METER_VALUE_STYLE, color: over ? T.accentWarn : T.inkSoft }}>
          {Math.round(current)}{unit}
        </span>
      </div>
      <MiniBar
        ratio={ratio}
        fill={fill}
        height={height}
        delay={delay}
        ariaLabel={`${label} progress`}
      />
    </div>
  );
}

const METER_LABEL_STYLE = {
  fontFamily: 'Inter',
  fontSize: 10,
  fontWeight: 600,
  color: T.inkSoft,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const METER_VALUE_STYLE = {
  fontFamily: 'Inter',
  fontSize: 10,
  fontWeight: 600,
};

/** 40×40 thumbnail — prefers a captured photo, falls back to a deterministic
 *  gradient + emoji swatch keyed off `meal.id` so pre-existing seeded history
 *  still looks alive. The look-up is stable across renders. */
function Thumbnail({ meal, emojisByName }: { meal: MealEntry; emojisByName: Record<string, string> }) {
  const fallback = pickThumbnailStyle(meal, emojisByName);
  return (
    <div
      aria-hidden="true"
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        flexShrink: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: meal.photoUrl ? `url(${meal.photoUrl})` : undefined,
        backgroundColor: meal.photoUrl ? undefined : fallback.bg,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontSize: 20,
        lineHeight: 1,
      }}
    >
      {!meal.photoUrl && fallback.emoji}
    </div>
  );
}

/**
 * Home / Capture screen — real camera integration.
 *
 * Flow:
 *   idle  → tap card → request camera → camera
 *   camera → tap shutter → capture frame → captured (calls onCapture + onClick)
 *   camera → tap "Use photo" button (file) → file picker → captured
 *   captured → retake → idle
 */
export default function CaptureScreen({
  onCapture,
  onClick,
  onReset,
  captured,
  previewUrl,
  onNavigateTab,
}: CaptureScreenProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [rippled, setRippled] = useState(false);
  const [pressed, setPressed] = useState(false);
  // Today summary now carries macro totals + the daily kcal target so the
  // progress bar can render without the Profile screen being open.
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [recentMeals, setRecentMeals] = useState<MealEntry[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const initialLoadRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Camera lifecycle ──────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      // Prefer rear camera on mobile, fall back to any
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase('camera');
    } catch (err: unknown) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission denied'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'No camera found'
            : 'Camera unavailable';
      setCameraError(msg);
      // Fall back to file picker immediately
      fileInputRef.current?.click();
    }
  }, []);

  // Load today's summary and recent meals on mount
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    let cancelled = false;
    getTodaySummary().then((s) => {
      if (!cancelled) {
        setTodaySummary(s);
        setTodayLoading(false);
      }
    });
    getMealHistory().then((h) => {
      if (!cancelled) {
        setRecentMeals(h.slice(0, 3));
        setHistoryLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Clean up camera on unmount or reset
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // When parent resets, stop camera and return to idle
  useEffect(() => {
    if (!captured) {
      stopCamera();
      setPhase('idle');
      setAnalyzing(false);
      setAnalyzeProgress(0);
      setCameraError(null);
    }
  }, [captured, stopCamera]);

  // ── Analyze progress animation ────────────────────────────────────────

  useEffect(() => {
    if (!analyzing) {
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
  }, [analyzing, reduceMotion]);

  // ── Capture frame from video ──────────────────────────────────────────

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, []);

  const handleShutter = useCallback(() => {
    const dataUrl = captureFrame();
    if (!dataUrl) return;

    stopCamera();
    setPhase('captured');
    setAnalyzing(true);
    onCapture?.(dataUrl);
    onClick();
  }, [captureFrame, stopCamera, onCapture, onClick]);

  // ── File upload fallback ──────────────────────────────────────────────

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        stopCamera();
        setPhase('captured');
        setAnalyzing(true);
        onCapture?.(dataUrl);
        onClick();
      };
      reader.readAsDataURL(file);
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [stopCamera, onCapture, onClick],
  );

  // ── Tap to start ──────────────────────────────────────────────────────

  const handleTapCard = () => {
    if (phase !== 'idle' || captured) return;
    setPressed(true);
    setRippled(true);
    setTimeout(() => setRippled(false), 600);
    setTimeout(() => setPressed(false), 200);
    startCamera();
  };

  // ── Determine what image to show ──────────────────────────────────────

  const displayUrl = previewUrl ?? null;

  // kcal ratio drives the over-target gradient on the headline progress bar.
  const kcalRatio = (todaySummary?.totalKcal ?? 0) / Math.max(1, todaySummary?.dailyKcalTarget ?? 1);

  // Macro mini-bars — pulled from the same MOCK_TARGETS source as NutrientsScreen
  // so the two screens stay in lockstep.
  const macroTargets = getMacroTargets();
  const MACRO_METERS = [
    { label: 'Protein', current: (s: TodaySummary) => s.totalProtein, target: () => macroTargets.protein, unit: 'g' as const, color: T.primary },
    { label: 'Carbs',   current: (s: TodaySummary) => s.totalCarbs,   target: () => macroTargets.carbs,   unit: 'g' as const, color: T.accentAmber },
    { label: 'Fat',     current: (s: TodaySummary) => s.totalFat,     target: () => macroTargets.fat,     unit: 'g' as const, color: T.accentGood },
  ];

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '20px 24px 0' }}>
      {/* Hidden elements */}
      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="glass-soft"
        style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          marginBottom: 12,
          padding: '6px 12px',
          borderRadius: 999,
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: 600,
          color: T.ink,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {getGreeting()}, {USER_NAME}
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

      {/* ── Capture card ──────────────────────────────────────────── */}
      <motion.button
        type="button"
        onClick={phase === 'idle' && !captured ? handleTapCard : undefined}
        disabled={captured}
        aria-label={
          captured
            ? 'Photo captured, analyzing'
            : phase === 'camera'
              ? 'Tap shutter to take a photo'
              : 'Tap to open camera'
        }
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
          background:
            phase === 'camera' || phase === 'captured'
              ? 'linear-gradient(160deg, #77574A, #4A3A34)'
              : T.cardBg,
          border:
            pressed || captured
              ? `2px solid ${T.primary}`
              : `2px dashed ${T.cardBorder}`,
          boxShadow:
            pressed || captured
              ? '0 14px 36px -14px rgba(46,37,34,0.55)'
              : '0 8px 32px rgba(46, 37, 34, 0.08)',
        }}
      >
        {/* Ripple effect on tap */}
        <AnimatePresence>
          {rippled && (
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
                zIndex: 10,
              }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        {/* ── Phase: idle — show CTA ─────────────────────────────── */}
        {phase === 'idle' && !captured && (
          <div style={{ textAlign: 'center', position: 'relative', padding: '0 20px' }}>
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
            <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 18, color: T.ink }}>
              Tap to open camera
            </div>
            <div style={{ fontFamily: 'Inter', fontSize: 14, color: T.inkSoft, marginTop: 6 }}>
              Plate, ingredients, or a menu — all work
            </div>

            {/* Upload fallback button */}
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              style={{
                marginTop: 16,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 14,
                background: 'rgba(74, 58, 52, 0.08)',
                border: '1px solid rgba(74, 58, 52, 0.18)',
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: 600,
                color: T.inkSoft,
                cursor: 'pointer',
              }}
            >
              <Upload size={12} /> Or upload a photo
            </motion.button>
          </div>
        )}

        {/* ── Phase: camera — live preview + shutter ─────────────── */}
        {phase === 'camera' && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 22,
              }}
            />

            {/* Viewfinder overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 22,
                boxShadow: 'inset 0 0 60px rgba(0,0,0,0.25)',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />

            {/* Shutter button */}
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleShutter();
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label="Take photo"
              style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 64,
                height: 64,
                borderRadius: '50%',
                border: '4px solid rgba(249, 242, 228, 0.9)',
                background: 'rgba(249, 242, 228, 0.25)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                cursor: 'pointer',
                padding: 0,
                zIndex: 5,
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              <motion.div
                whileTap={{ scale: 0.85 }}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                }}
              />
            </motion.button>

            {/* Cancel / switch to upload */}
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                stopCamera();
                setPhase('idle');
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label="Close camera"
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                zIndex: 5,
              }}
            >
              <X size={16} color="#FFFFFF" strokeWidth={2} />
            </motion.button>

            {/* Upload from gallery */}
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label="Upload from gallery"
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                zIndex: 5,
              }}
            >
              <Upload size={14} color="#FFFFFF" strokeWidth={2} />
            </motion.button>

            {/* Camera error fallback */}
            {cameraError && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 90,
                  left: 16,
                  right: 16,
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: 'rgba(201, 98, 45, 0.9)',
                  color: '#FFFFFF',
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: 'center',
                  zIndex: 5,
                }}
              >
                {cameraError} — using file picker
              </div>
            )}
          </>
        )}

        {/* ── Phase: captured — analyzing animation ──────────────── */}
        {(phase === 'captured' || captured) && (
          <>
            {/* Background gradient */}
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

            {/* Preview image (if available) */}
            {displayUrl && (
              <motion.img
                src={displayUrl}
                alt="Captured meal"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 22,
                }}
              />
            )}

            {/* Filename label */}
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
                zIndex: 2,
              }}
            >
              captured_photo.jpg
            </motion.div>

            {/* Progress ring */}
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
                zIndex: 2,
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

            {/* Retake button */}
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
                zIndex: 2,
              }}
            >
              <X size={16} color={T.earth6} strokeWidth={2} />
            </motion.button>
          </>
        )}
      </motion.button>

      {/* ── Status / hint area ───────────────────────────────────── */}
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
        ) : phase === 'camera' ? (
          <motion.div
            key="camera-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              marginTop: 16,
              fontFamily: 'Inter',
              fontSize: 12,
              color: T.inkSoft,
              textAlign: 'center',
            }}
          >
            Line up your plate and tap the shutter
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
            Tap the card to open your camera
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick Actions (only when idle) ─────────────────────── */}
      {phase === 'idle' && !captured && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 16,
            overflowX: 'auto',
            paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {[
            {
              icon: UtensilsCrossed,
              label: 'Log Meal',
              color: T.primary,
              // Log Meal = primary CTA, opens camera like the capture card
              onClick: handleTapCard,
            },
            {
              icon: History,
              label: 'Recent',
              color: T.accentAmber,
              // Recent = scroll-anchor to the recent-meals section. Until we
              // have a dedicated History tab, anchoring keeps the affordance
              // honest rather than faking navigation. We call onNavigateTab
              // only if a parent handler was provided (smoke testing on its
              // own).
              onClick: () => {
                const el = document.getElementById('recent-meals-section');
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              },
            },
            {
              icon: ShoppingBag,
              label: 'Grocery',
              color: T.accentGood,
              onClick: () => onNavigateTab?.(TAB_GROCERY),
            },
          ].map((a) => (
            <motion.button
              key={a.label}
              type="button"
              onClick={a.onClick}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 14,
                background: 'rgba(249, 242, 228, 0.75)',
                border: '1px solid rgba(74, 58, 52, 0.15)',
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: 600,
                color: T.ink,
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <a.icon size={14} color={a.color} strokeWidth={2} />
              {a.label}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* ── Today's Summary Skeleton ────────────────────────── */}
      {phase === 'idle' && !captured && todayLoading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3 }}
          className="glass-card"
          style={{ borderRadius: 18, padding: '14px 16px', marginTop: 16 }}
        >
          <div className="skeleton" style={{ width: 90, height: 12, marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: 40, height: 22, marginBottom: 6 }} />
              <div className="skeleton" style={{ width: 70, height: 10 }} />
            </div>
            <div style={{ width: 1, background: T.cardBorder, alignSelf: 'stretch' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: 48, height: 22, marginBottom: 6 }} />
              <div className="skeleton" style={{ width: 80, height: 10 }} />
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Today's Summary Card ──────────────────────────────── */}
      {phase === 'idle' && !captured && todaySummary && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3 }}
          role={todaySummary.mealsLogged > 0 ? 'button' : undefined}
          tabIndex={todaySummary.mealsLogged > 0 ? 0 : -1}
          onClick={() => {
            // Tap → scroll to recent meals so the user lands somewhere
            // useful. We don't have a history tab yet; deep-linking to
            // Results doesn't help because Results is the *current*
            // detection, not history.
            const el = document.getElementById('recent-meals-section');
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const el = document.getElementById('recent-meals-section');
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          className="glass-card"
          style={{
            borderRadius: 18,
            padding: '14px 16px',
            marginTop: 16,
            cursor: todaySummary.mealsLogged > 0 ? 'pointer' : 'default',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Today's Summary
            </span>
            {todaySummary.mealsLogged > 0 ? (
              <ChevronRight size={14} color={T.inkSoft} aria-hidden="true" />
            ) : (
              <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Empty
              </span>
            )}
          </div>

          {todaySummary.mealsLogged === 0 ? (
            // ── Empty state — render something useful so the section is
            //    always present. Don't hide the card just because nothing's
            //    logged yet.
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: T.inkSoft,
                fontFamily: 'Inter',
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              <UtensilsCrossed size={16} color={T.inkMuted} strokeWidth={1.8} />
              <span>
                No meals yet today — <strong style={{ color: T.ink }}>snap your first</strong> to start tracking.
              </span>
            </div>
          ) : (
            <>
              {/* Top row: meals + kcal + progress bar */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                <span className="tnum" style={{ fontFamily: 'Inter', fontSize: 22, fontWeight: 700, color: T.ink }}>
                  {Math.round(todaySummary.totalKcal)}
                </span>
                <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: T.inkSoft }}>
                  / {todaySummary.dailyKcalTarget} kcal
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: 'Inter', fontSize: 11, color: T.inkSoft }}>
                  {todaySummary.mealsLogged} meal{todaySummary.mealsLogged !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ marginBottom: 12 }}>
                <MiniBar
                  ratio={kcalRatio}
                  fill={
                    kcalRatio > 1
                      ? `linear-gradient(90deg, ${T.accentWarn}, ${T.accentAmber})`
                      : `linear-gradient(90deg, ${T.primary}, ${T.accentGood})`
                  }
                  height={6}
                  ariaLabel="Today's kcal progress"
                  ariaValueNow={Math.round(todaySummary.totalKcal)}
                  ariaValueMax={todaySummary.dailyKcalTarget}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                }}
              >
                {MACRO_METERS.map((m) => (
                  <MacroMeter
                    key={m.label}
                    label={m.label}
                    current={m.current(todaySummary)}
                    target={m.target()}
                    unit={m.unit}
                    color={m.color}
                    delay={0.05}
                  />
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* ── Recent Meals Skeleton ──────────────────────────── */}
      {phase === 'idle' && !captured && historyLoading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.35 }}
          style={{ marginTop: 18 }}
        >
          <div className="skeleton" style={{ width: 90, height: 12, marginBottom: 10 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, padding: '10px 14px' }}>
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: `${100 - i * 15}%`, height: 14, marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: 80, height: 10 }} />
                </div>
                <div className="skeleton" style={{ width: 50, height: 16, marginLeft: 8 }} />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Recent Meals ──────────────────────────────────────── */}
      {phase === 'idle' && !captured && (
        <motion.div
          id="recent-meals-section"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.35 }}
          style={{ marginTop: 18, scrollMarginTop: 90 }}
        >
          <div style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Recent Meals
          </div>

          {/* Empty state — only render after we've confirmed history is
              loaded and truly empty. While loading, the skeleton above holds
              the slot so we don't flash. */}
          {!historyLoading && recentMeals.length === 0 && (
            <div
              className="glass-card"
              style={{
                borderRadius: 14,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: T.inkSoft,
                fontFamily: 'Inter',
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              <History size={16} color={T.inkMuted} strokeWidth={1.8} />
              <span>
                Your last few meals will appear here once you log them.
              </span>
            </div>
          )}

          {recentMeals.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentMeals.map((meal) => (
                <motion.div
                  key={meal.id}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 14,
                    padding: '8px 14px 8px 8px',
                  }}
                >
                  <Thumbnail meal={meal} emojisByName={descriptorEmojiMap} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {meal.label}
                    </div>
                    <div style={{ fontFamily: 'Inter', fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                      {formatRelative(meal.date)} · {meal.items.length} item{meal.items.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="tnum" style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 700, color: T.accentAmber, flexShrink: 0, marginLeft: 8 }}>
                    {Math.round(meal.totals.kcal)}
                    <span style={{ fontSize: 10, fontWeight: 500, color: T.inkSoft }}> kcal</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

/** Map of food name → emoji glyph from MOCK_NUTRITION_DB. Built once at
 *  module load — cheap (4 entries today), no re-computation per render. */
const descriptorEmojiMap: Record<string, string> = Object.fromEntries(
  Object.entries(NUTRITION_DB).map(([k, v]) => [k, v.emoji]),
);
