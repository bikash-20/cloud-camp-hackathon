import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { LogIn, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { T } from '../../data';
import { loginWithGoogle } from '../../lib/auth';
import { initGoogleAuth } from '../../lib/googleAuth';
import type { AuthSession } from '../../types/schemas';
import PhoneFrame from '../PhoneFrame';
import LanguageToggle from '../../i18n/LanguageToggle';
import { LocalizedContent, useLanguage } from '../../i18n/LanguageContext';

interface LoginScreenProps {
  /** Called with the new session once login succeeds. */
  onSignedIn: (session: AuthSession) => void;
}

const GOOGLE_CLIENT_ID: string = (
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID
    ? import.meta.env.VITE_GOOGLE_CLIENT_ID
    : ''
).trim();

export default function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const { language } = useLanguage();
  const isBn = language === 'bn';
  const reduceMotion = useReducedMotion();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let mounted = true;
    void initGoogleAuth({
      clientId: GOOGLE_CLIENT_ID,
      buttonContainer: googleBtnContainerRef.current,
      buttonWidth: 320,
      locale: isBn ? 'bn' : 'en',
      promptOneTap: true,
      onSuccess: async (credential) => {
        if (!mounted) return;
        setGoogleLoading(true);
        setError(null);
        try {
          const session = await loginWithGoogle(credential);
          if (mounted) onSignedIn(session);
        } catch (err: unknown) {
          if (mounted) {
            const msg =
              err instanceof Error
                ? err.message
                : isBn
                ? 'গুগল সাইন ইন সম্পন্ন করা যায়নি'
                : 'Google sign-in could not be completed';
            setError(msg);
          }
        } finally {
          if (mounted) setGoogleLoading(false);
        }
      },
      onError: (err: unknown) => {
        if (mounted) {
          // eslint-disable-next-line no-console
          console.warn('Google Identity Services button error:', err);
        }
      },
    });

    return () => {
      mounted = false;
    };
  }, [isBn, onSignedIn]);

  return (
    <LocalizedContent>
      <PhoneFrame headerRight={<LanguageToggle />}>
        <div
          style={{
            padding: '28px var(--screen-gutter, 24px) 36px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            minHeight: '100%',
            width: '100%',
            maxWidth: 480,
            marginInline: 'auto',
            justifyContent: 'center',
          }}
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: 'center' }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 18,
                background: 'rgba(74, 58, 52, 0.94)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                boxShadow: '0 12px 28px -10px rgba(46, 37, 34, 0.55)',
              }}
            >
              <LogIn size={28} color="#F9F2E4" strokeWidth={2.2} />
            </div>
            <h1
              style={{
                fontFamily: 'Inter',
                fontSize: 24,
                fontWeight: 700,
                color: T.ink,
                margin: '0 0 6px',
                letterSpacing: '-0.02em',
              }}
            >
              {isBn ? 'নিউট্রিভিশন এআই' : 'NutriVision AI'}
            </h1>
            <p
              style={{
                fontFamily: 'Inter',
                fontSize: 13.5,
                color: T.inkSoft,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {isBn
                ? 'আপনার খাবারের ছবি তুলে পুষ্টি বিশ্লেষণ ও স্থানীয় কেনাকাটার তালিকা পেতে সাইন ইন করুন।'
                : 'Sign in with your Google account to access your personalized nutrition intelligence and meal tracking.'}
            </p>
          </motion.div>

          {/* Primary Action Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="glass-card"
            style={{
              borderRadius: 22,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              background: 'rgba(255, 255, 255, 0.82)',
              border: '1px solid rgba(74, 58, 52, 0.15)',
              boxShadow: '0 12px 32px -8px rgba(74, 58, 52, 0.08)',
            }}
          >
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: 700,
                color: T.inkSoft,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {isBn ? 'গুগল অ্যাকাউন্ট দিয়ে সাইন ইন' : 'Sign in with Google'}
            </div>

            {/* Official GSI Button Mount */}
            {GOOGLE_CLIENT_ID ? (
              <div
                ref={googleBtnContainerRef}
                style={{
                  minHeight: 46,
                  display: 'flex',
                  justifyContent: 'center',
                  width: '100%',
                }}
              />
            ) : (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'rgba(217, 119, 6, 0.1)',
                  border: '1px solid rgba(217, 119, 6, 0.3)',
                  color: T.accentWarn,
                  fontSize: 12,
                  lineHeight: 1.4,
                  textAlign: 'center',
                }}
              >
                {isBn
                  ? 'গুগল ক্লায়েন্ট আইডি সেট করা নেই। দয়া করে VITE_GOOGLE_CLIENT_ID পরিবেশ ভেরিয়েবল সেট করুন।'
                  : 'Google Client ID is not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment variables.'}
              </div>
            )}

            {/* Loading / Cold start indicator */}
            <AnimatePresence>
              {googleLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'rgba(74, 58, 52, 0.06)',
                    width: '100%',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RefreshCw
                      size={15}
                      color={T.primary}
                      className={reduceMotion ? '' : 'animate-spin'}
                      style={{ animation: 'spin 1.5s linear infinite' }}
                    />
                    <span style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: T.ink }}>
                      {isBn ? 'যাচাই করা হচ্ছে…' : 'Verifying with server…'}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: 'Inter',
                      fontSize: 11.5,
                      color: T.inkSoft,
                      lineHeight: 1.4,
                      maxWidth: 280,
                    }}
                  >
                    {isBn
                      ? 'সার্ভার কোল্ড স্টার্ট হলে প্রথমবার ৩০-৪৫ সেকেন্ড সময় লাগতে পারে।'
                      : 'Render free tier may take 30–45s to wake up on first visit.'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  role="alert"
                  aria-live="assertive"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Inter', fontSize: 12.5, fontWeight: 600, color: '#DC2626' }}>
                      {isBn ? 'সাইন ইন ব্যর্থ হয়েছে' : 'Sign in failed'}
                    </div>
                    <div
                      style={{
                        fontFamily: 'Inter',
                        fontSize: 11.5,
                        color: T.ink,
                        marginTop: 2,
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}
                    >
                      {error}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Security & Multi-User notice */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '6px 12px',
              textAlign: 'center',
            }}
          >
            <ShieldCheck size={14} color={T.inkSoft} />
            <span
              style={{
                fontFamily: 'Inter',
                fontSize: 11.5,
                color: T.inkSoft,
              }}
            >
              {isBn
                ? 'গুগল ওঅথ ২.০ এবং সুরক্ষিত ব্যাকএন্ড পারসিস্টেন্স'
                : 'Secured via Google OAuth 2.0 & encrypted JWT sessions'}
            </span>
          </motion.div>
        </div>
      </PhoneFrame>
    </LocalizedContent>
  );
}
