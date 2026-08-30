import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';
import { T } from '../data';

const DISMISS_KEY = 'nutrivision-pwa-install-dismissed';
const DISMISS_EXPIRY_MS = 24 * 60 * 60 * 1000; // Re-show after 24 hours

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA install notification banner.
 *
 * Listens for the browser's `beforeinstallprompt` event and shows a
 * styled banner at the top of the screen. Respects dismiss state
 * via localStorage with a 24-hour expiry.
 */
export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Check if already dismissed
  const isDismissed = (): boolean => {
    try {
      const val = localStorage.getItem(DISMISS_KEY);
      if (!val) return false;
      const ts = parseInt(val, 10);
      if (Number.isNaN(ts)) return false;
      // Re-show after expiry
      if (Date.now() - ts > DISMISS_EXPIRY_MS) {
        localStorage.removeItem(DISMISS_KEY);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    // If already installed or dismissed, don't listen
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((navigator as any).standalone) return; // iOS Safari
    if (isDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after a short delay so it doesn't feel abrupt
      setTimeout(() => setShowBanner(true), 1500);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Also detect if the app was installed while the page is open
    const installedHandler = () => {
      setInstalled(true);
      setShowBanner(false);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setShowBanner(false);
      }
    } catch {
      // User cancelled or error
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      // localStorage unavailable
    }
  };

  // Don't show if already installed or no prompt available
  if (installed || !showBanner || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          ref={bannerRef}
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          role="alert"
          aria-label="Install NutriVision AI app"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            padding: 'env(safe-area-inset-top, 0px) 12px 0',
          }}
        >
          <div
            style={{
              margin: '8px auto',
              maxWidth: 480,
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 16px 48px -8px rgba(46, 37, 34, 0.35), 0 0 0 1px rgba(255,255,255,0.15) inset',
              background: 'linear-gradient(135deg, #4A3A34 0%, #77574A 100%)',
            }}
          >
            {/* Gradient shimmer overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(120deg, transparent 30%, rgba(249,242,228,0.06) 50%, transparent 70%)',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                position: 'relative',
              }}
            >
              {/* App icon */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(249, 242, 228, 0.15)',
                  border: '1px solid rgba(249, 242, 228, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Smartphone size={22} color={T.earth6} strokeWidth={1.8} />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.earth6,
                    lineHeight: 1.3,
                  }}
                >
                  Install NutriVision
                </div>
                <div
                  style={{
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'rgba(249, 242, 228, 0.6)',
                    marginTop: 2,
                    lineHeight: 1.3,
                  }}
                >
                  Add to home screen for quick access
                </div>
              </div>

              {/* Install button */}
              <motion.button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '8px 14px',
                  borderRadius: 12,
                  background: T.earth6,
                  border: 'none',
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.primary,
                  cursor: installing ? 'default' : 'pointer',
                  opacity: installing ? 0.7 : 1,
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}
              >
                <Download size={13} strokeWidth={2.5} />
                {installing ? 'Installing…' : 'Install'}
              </motion.button>

              {/* Dismiss button */}
              <motion.button
                type="button"
                onClick={handleDismiss}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                aria-label="Dismiss install banner"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(249, 242, 228, 0.1)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <X size={12} color="rgba(249, 242, 228, 0.6)" strokeWidth={2.5} />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
