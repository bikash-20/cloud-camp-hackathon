import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { T, TABS } from './data';
import { getProfile } from './lib/api';
import { analyzeMeal } from './lib/api';
import type { DetectedItem, PipelineTrace, UserProfile } from './types/schemas';
import PhoneFrame from './components/PhoneFrame';
import BottomNav from './components/BottomNav';
import StepDots from './components/StepDots';
import CaptureScreen from './components/screens/CaptureScreen';
import ResultsScreen from './components/screens/ResultsScreen';
import NutrientsScreen from './components/screens/NutrientsScreen';
import ProfileScreen from './components/screens/ProfileScreen';
import GroceryScreen from './components/screens/GroceryScreen';
import PwaInstallBanner from './components/PwaInstallBanner';

export default function App() {
  const [tab, setTab] = useState(0);
  const [direction, setDirection] = useState(1);
  const [captured, setCaptured] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pipeline, setPipeline] = useState<PipelineTrace[]>([]);
  const [pipelineToast, setPipelineToast] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  // Load profile on mount (mock async)
  useEffect(() => {
    let cancelled = false;
    getProfile().then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => { cancelled = true; };
  }, []);

  const goToTab = (next: number) => {
    if (next === tab) return;
    setDirection(next > tab ? 1 : -1);
    setTab(next);
  };

  const handleCapture = async (imageDataUrl?: string) => {
    setCaptured(true);
    if (imageDataUrl) setCapturedImage(imageDataUrl);
    setDirection(1);
    setPipelineToast('Cache check · Vision ID · HF validate · Reconcile');

    // Fire the (mock) dual vision pipeline
    const imageRef = imageDataUrl ? 'captured_photo.jpg' : 'chicken_biryani.jpg';
    try {
      const { detected: next, pipeline: trace } = await analyzeMeal(imageRef);
      setDetected(next);
      setPipeline(trace);
      // Briefly surface the pipeline trace for the demo, then advance
      setTimeout(() => {
        setPipelineToast(null);
        goToTab(1);
      }, 1100);
    } catch (err) {
      setPipelineToast('Pipeline error — using fallback');
      setTimeout(() => {
        setPipelineToast(null);
        goToTab(1);
      }, 1100);
    }
  };

  const handleRetake = () => {
    setCaptured(false);
    setCapturedImage(null);
    setDetected([]);
    setPipeline([]);
  };

  if (!profile) {
    // Tiny loading skeleton (renders while the (mock) profile resolves)
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: T.inkSoft,
          fontFamily: 'Inter',
          fontSize: 12,
        }}
      >
        Loading profile…
      </div>
    );
  }

  return (
    <>
    <PwaInstallBanner />
    <PhoneFrame headerRight={<StepDots active={tab} onChange={goToTab} />}>
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={tab}
          custom={direction}
          initial={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, x: 24 * direction }
          }
          animate={{ opacity: 1, x: 0 }}
          exit={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, x: -24 * direction }
          }
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          style={{
            paddingBottom: 110,
            position: 'relative',
            zIndex: 1,
          }}
          id={`panel-${TABS[tab].id}`}
          role="tabpanel"
          aria-labelledby={`tab-${TABS[tab].id}`}
        >
          {tab === 0 && (
            <CaptureScreen
              onCapture={(dataUrl) => handleCapture(dataUrl)}
              onClick={() => handleCapture()}
              onReset={handleRetake}
              captured={captured}
              previewUrl={capturedImage}
            />
          )}
          {tab === 1 && (
            <ResultsScreen
              detected={detected}
              onChangeDetected={setDetected}
              onViewNutrients={() => goToTab(2)}
              profile={profile}
              capturedImage={capturedImage}
            />
          )}
          {tab === 2 && <NutrientsScreen detected={detected} profile={profile} />}
          {tab === 3 && (
            <ProfileScreen
              profile={profile}
              onProfileChange={setProfile}
            />
          )}
          {tab === 4 && <GroceryScreen profile={profile} />}
        </motion.div>
      </AnimatePresence>

      {/* Pipeline trace toast — proves the dual-vision pipeline is wired */}
      <AnimatePresence>
        {pipelineToast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              top: 110,
              padding: '10px 14px',
              borderRadius: 14,
              background: 'rgba(46, 37, 34, 0.92)',
              color: '#FFFFFF',
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 30,
              boxShadow: '0 8px 24px rgba(46, 37, 34, 0.30)',
            }}
          >
            <motion.span
              animate={reduceMotion ? {} : { rotate: 360 }}
              transition={reduceMotion ? {} : { duration: 1.6, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-flex', width: 14, height: 14 }}
            >
              <svg width={14} height={14} viewBox="0 0 14 14">
                <circle cx={7} cy={7} r={5} stroke="rgba(249, 242, 228, 0.4)" strokeWidth={2} fill="none" />
                <motion.circle
                  cx={7}
                  cy={7}
                  r={5}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray={2 * Math.PI * 5}
                  strokeDashoffset={2 * Math.PI * 5 * 0.7}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
              </svg>
            </motion.span>
            <span style={{ flex: 1 }}>{pipelineToast}</span>
            {pipeline.length > 0 && (
              <span
                className="tnum"
                style={{
                  fontSize: 9.5,
                  color: 'rgba(249, 242, 228, 0.7)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {pipeline.length} stages
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav active={tab} onChange={goToTab} />

      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        style={{ position: 'absolute', left: -9999 }}
      >
        Viewing {TABS[tab].label}
      </div>
    </PhoneFrame>
    </>
  );
}