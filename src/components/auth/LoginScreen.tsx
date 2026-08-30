import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { LogIn, ShieldCheck, User as UserIcon, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { T } from '../../data';
import { login, SEEDED_ACCOUNTS } from '../../lib/auth';
import type { AuthSession } from '../../types/schemas';
import PhoneFrame from '../PhoneFrame';

interface LoginScreenProps {
  /** Called with the new session once login succeeds. */
  onSignedIn: (session: AuthSession) => void;
}

/**
 * Phone-framed login screen.
 *
 * Two-field form + two "Try a demo account" chips (admin / user) that
 * autofill the form with the seeded demo credentials. Judges tap once,
 * the form fills, then they tap Sign In.
 */
export default function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const session = await login(email, password);
    setSubmitting(false);
    if (!session) {
      setError('Email or password not recognized');
      setShake((n) => n + 1);
      emailRef.current?.focus();
      return;
    }
    onSignedIn(session);
  };

  const fillDemo = (kind: 'admin' | 'user') => {
    const account = SEEDED_ACCOUNTS.find((a) =>
      kind === 'admin' ? a.role === 'admin' : a.role === 'user',
    );
    if (!account) return;
    setEmail(account.email);
    setPassword(account.demoPassword);
    setError(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PhoneFrame>
      <div
        style={{
          padding: '24px 24px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          minHeight: '100%',
        }}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{ textAlign: 'center', marginTop: 12 }}
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
              margin: '0 auto 14px',
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
            NutriVision AI
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
            Sign in to track meals or open the admin dashboard.
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          key={shake}
          initial={false}
          animate={
            error
              ? { x: [0, -6, 6, -4, 4, 0] }
              : { x: 0 }
          }
          transition={{ x: { duration: 0.35 } }}
          onSubmit={handleSubmit}
          className="glass-card"
          style={{
            borderRadius: 22,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
          noValidate
        >
          <Field
            icon={<Mail size={14} color={T.inkSoft} strokeWidth={2} />}
            label="Email"
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
              aria-label="Email address"
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
                padding: '6px 0',
              }}
            />
          </Field>

          <Field
            icon={<Lock size={14} color={T.inkSoft} strokeWidth={2} />}
            label="Password"
            right={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
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
              aria-label="Password"
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
                padding: '6px 0',
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
            aria-label="Sign in"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '13px 16px',
              borderRadius: 14,
              background: T.primary,
              border: `1px solid ${T.primaryDeep}`,
              color: '#FFFFFF',
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              marginTop: 4,
              boxShadow: '0 8px 18px -8px rgba(46, 37, 34, 0.55)',
            }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
            {!submitting && <ArrowRight size={14} strokeWidth={2.5} />}
          </motion.button>
        </motion.form>

        {/* Demo chips */}
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
            }}
          >
            Try a demo account
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <DemoChip
              icon={<ShieldCheck size={13} color={T.primary} strokeWidth={2.2} />}
              label="Admin"
              onClick={() => fillDemo('admin')}
            />
            <DemoChip
              icon={<UserIcon size={13} color={T.primary} strokeWidth={2.2} />}
              label="User"
              onClick={() => fillDemo('user')}
            />
          </div>
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 10,
              color: T.inkMuted,
              marginTop: 10,
              lineHeight: 1.45,
            }}
          >
            Admin → KPI dashboard.
            <br />
            User → regular PWA.
          </div>
        </motion.div>
      </div>
    </PhoneFrame>
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
          padding: '10px 12px',
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
        padding: '8px 14px',
        borderRadius: 999,
        background: 'rgba(74, 58, 52, 0.10)',
        border: '1px solid rgba(74, 58, 52, 0.22)',
        color: T.ink,
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
    </motion.button>
  );
}