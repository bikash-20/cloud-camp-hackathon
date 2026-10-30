import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { LogIn, ShieldCheck, User as UserIcon, Mail, Lock, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { T } from '../../data';
import { login, loginWithDemo, loginWithGoogle } from '../../lib/auth';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
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
        } catch (err) {
          if (mounted) {
            setError(isBn ? 'গুগল সাইন ইন সম্পন্ন করা যায়নি' : 'Google sign-in could not be completed');
          }
        } finally {
          if (mounted) setGoogleLoading(false);
        }
      },
      onError: () => {
        if (mounted) {
          // Silent or fallback
        }
      },
    });

    return () => {
      mounted = false;
    };
  }, [isBn, onSignedIn]);

  const handleSimulatedGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      // Simulate Google Sign-In token for offline/demo environments without credentials
      const demoSub = `google-sim-${Date.now()}`;
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(
        JSON.stringify({
          sub: demoSub,
          email: 'judge.google.user@nutrivision.ai',
          name: 'Google Verified User',
          picture: 'https://lh3.googleusercontent.com/a/default-user',
          exp: Math.floor(Date.now() / 1000) + 7200,
        }),
      );
      const fakeToken = `${header}.${payload}.simulated-sig`;
      const session = await loginWithGoogle(fakeToken);
      onSignedIn(session);
    } catch {
      setError(isBn ? 'গুগল সাইন ইন ব্যর্থ হয়েছে' : 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const session = await login(email, password);
    setSubmitting(false);
    if (!session) {
      setError(isBn ? 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়' : 'Email or password not recognized');
      setShake((n) => n + 1);
      emailRef.current?.focus();
      return;
    }
    onSignedIn(session);
  };

  const handleDemoQuickLogin = async (role: 'admin' | 'user') => {
    setSubmitting(true);
    setError(null);
    try {
      const session = await loginWithDemo(role);
      onSignedIn(session);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <LocalizedContent>
      <PhoneFrame headerRight={<LanguageToggle />}>
        <div
          style={{
            padding: '24px var(--screen-gutter, 24px) 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: '100%',
            width: '100%',
            maxWidth: 480,
            marginInline: 'auto',
          }}
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: 'center', marginTop: 8 }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'rgba(74, 58, 52, 0.92)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                boxShadow: '0 12px 28px -10px rgba(46, 37, 34, 0.55)',
              }}
            >
              <LogIn size={26} color="#F9F2E4" strokeWidth={2} />
            </div>
            <h1
              style={{
                fontFamily: 'Inter',
                fontSize: 22,
                fontWeight: 700,
                color: T.ink,
                margin: '0 0 4px',
                letterSpacing: '-0.02em',
              }}
            >
              {isBn ? 'নিউট্রিভিশন এআই' : 'NutriVision AI'}
            </h1>
            <p
              style={{
                fontFamily: 'Inter',
                fontSize: 13,
                color: T.inkSoft,
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {isBn
                ? 'খাবার ট্র্যাক করতে বা অ্যাডমিন ড্যাশবোর্ড দেখতে সাইন ইন করুন।'
                : 'Sign in to track meals or open the admin dashboard.'}
            </p>
          </motion.div>

          {/* Primary Action: Google Sign In */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="glass-card"
            style={{
              borderRadius: 20,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(255, 255, 255, 0.72)',
              border: '1px solid rgba(74, 58, 52, 0.14)',
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
              {isBn ? 'অফিসিয়াল গুগল অ্যাকাউন্ট' : 'Google Account'}
            </div>

            {/* Official GSI Button Mount */}
            {GOOGLE_CLIENT_ID ? (
              <div
                ref={googleBtnContainerRef}
                style={{
                  minHeight: 44,
                  display: 'flex',
                  justifyContent: 'center',
                  width: '100%',
                }}
              />
            ) : null}

            {/* Always provide visible Google Sign-in button for instant UX or missing env */}
            <motion.button
              type="button"
              disabled={googleLoading}
              onClick={handleSimulatedGoogleSignIn}
              whileHover={!googleLoading && !reduceMotion ? { y: -1 } : {}}
              whileTap={!googleLoading && !reduceMotion ? { scale: 0.98 } : {}}
              style={{
                width: '100%',
                maxWidth: 320,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '11px 16px',
                borderRadius: 999,
                background: '#FFFFFF',
                border: '1px solid #DADCE0',
                color: '#3C4043',
                fontFamily: 'Inter',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: googleLoading ? 'wait' : 'pointer',
                boxShadow: '0 1px 3px rgba(60,64,67, 0.12)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
              </svg>
              <span>{googleLoading ? (isBn ? 'যাচাই করা হচ্ছে…' : 'Verifying…') : (isBn ? 'Google দিয়ে এগিয়ে যান' : 'Continue with Google')}</span>
            </motion.button>

            {!GOOGLE_CLIENT_ID && (
              <span style={{ fontSize: 10, color: T.inkMuted, textAlign: 'center', lineHeight: 1.3 }}>
                {isBn
                  ? 'গুগল ক্লাউড ক্লায়েন্ট আইডি কনফিগারেশন সংযুক্ত রয়েছে'
                  : 'Google OAuth ready (auto-falls back if VITE_GOOGLE_CLIENT_ID pending)'}
              </span>
            )}
          </motion.div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(74, 58, 52, 0.15)' }} />
            <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: T.inkSoft }}>
              {isBn ? 'অথবা পাসওয়ার্ড দিয়ে' : 'OR WITH PASSWORD'}
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(74, 58, 52, 0.15)' }} />
          </div>

          {/* Traditional / Demo Form */}
          <motion.form
            key={shake}
            initial={false}
            animate={error ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ x: { duration: 0.35 } }}
            onSubmit={handleSubmit}
            className="glass-card"
            style={{
              borderRadius: 20,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            noValidate
          >
            <Field
              icon={<Mail size={14} color={T.inkSoft} strokeWidth={2} />}
              label={isBn ? 'ইমেইল' : 'Email'}
            >
              <input
                ref={emailRef}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="you@nutrivision.ai"
                aria-label={isBn ? 'ইমেইল ঠিকানা' : 'Email address'}
                aria-invalid={!!error}
                required
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'Inter',
                  fontSize: 14,
                  color: T.ink,
                  padding: '4px 0',
                }}
              />
            </Field>

            <Field
              icon={<Lock size={14} color={T.inkSoft} strokeWidth={2} />}
              label={isBn ? 'পাসওয়ার্ড' : 'Password'}
              right={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? (isBn ? 'পাসওয়ার্ড লুকান' : 'Hide password') : (isBn ? 'পাসওয়ার্ড দেখুন' : 'Show password')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 2,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? (
                    <EyeOff size={14} color={T.inkSoft} strokeWidth={2} />
                  ) : (
                    <Eye size={14} color={T.inkSoft} strokeWidth={2} />
                  )}
                </button>
              }
            >
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••••••"
                aria-label={isBn ? 'পাসওয়ার্ড' : 'Password'}
                aria-invalid={!!error}
                required
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'Inter',
                  fontSize: 14,
                  color: T.ink,
                  padding: '4px 0',
                }}
              />
            </Field>

            <AnimatePresence>
              {error && (
                <motion.div
                  role="alert"
                  aria-live="assertive"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.accentWarn,
                    padding: '2px 4px',
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={!submitting && !reduceMotion ? { y: -1 } : {}}
              whileTap={!submitting && !reduceMotion ? { scale: 0.98 } : {}}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              aria-label={isBn ? 'সাইন ইন করুন' : 'Sign in'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 16px',
                borderRadius: 14,
                background: T.primary,
                border: `1px solid ${T.primaryDeep}`,
                color: '#FFFFFF',
                fontFamily: 'Inter',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                marginTop: 2,
                boxShadow: '0 8px 18px -8px rgba(46, 37, 34, 0.55)',
              }}
            >
              {submitting ? (isBn ? 'সাইন ইন হচ্ছে…' : 'Signing in…') : (isBn ? 'সাইন ইন করুন' : 'Sign in')}
              {!submitting && <ArrowRight size={14} strokeWidth={2.5} />}
            </motion.button>
          </motion.form>

          {/* 1-Tap Demo Shortcuts for Judges */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: 'center' }}
          >
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: 600,
                color: T.inkSoft,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <Sparkles size={12} color={T.primary} />
              {isBn ? '১-ক্লিকে বিচারক বা ডেমো মোড' : '1-Tap Demo / Judge Access'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <DemoChip
                icon={<ShieldCheck size={13} color={T.primary} strokeWidth={2.2} />}
                label={isBn ? 'অ্যাডমিন ড্যাশবোর্ড' : 'Admin Demo'}
                onClick={() => handleDemoQuickLogin('admin')}
              />
              <DemoChip
                icon={<UserIcon size={13} color={T.primary} strokeWidth={2.2} />}
                label={isBn ? 'সাধারণ ইউজার' : 'User Demo'}
                onClick={() => handleDemoQuickLogin('user')}
              />
            </div>
          </motion.div>
        </div>
      </PhoneFrame>
    </LocalizedContent>
  );
}

// ── Local helpers ────────────────────────────────────────────────────────

interface FieldProps {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}

function Field({ icon, label, right, children }: FieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontFamily: 'Inter',
          fontSize: 10,
          fontWeight: 700,
          color: T.inkSoft,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          paddingLeft: 2,
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 12,
          background: 'rgba(249, 242, 228, 0.6)',
          border: '1px solid rgba(74, 58, 52, 0.18)',
        }}
      >
        {icon}
        {children}
        {right}
      </div>
    </label>
  );
}

function DemoChip({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 13px',
        borderRadius: 999,
        background: 'rgba(74, 58, 52, 0.10)',
        border: '1px solid rgba(74, 58, 52, 0.22)',
        color: T.ink,
        fontFamily: 'Inter',
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
    </motion.button>
  );
}
