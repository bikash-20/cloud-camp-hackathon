import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { LogOut, LayoutDashboard, Users as UsersIcon, Trophy, AlertTriangle, ChevronDown } from 'lucide-react';
import type { AuthSession } from '../../types/schemas';
import { logout } from '../../lib/auth';

interface AdminLayoutProps {
  session: AuthSession;
  children: React.ReactNode;
}

/**
 * Responsive shell for the admin dashboard.
 *
 * Layout:
 *   • Desktop ≥ 768px — fixed left sidebar (240px) with nav + user chip +
 *     scrollable main pane on the right.
 *   • Mobile < 768px — sidebar collapses to a top bar. Nav opens in a
 *     dropdown menu when the bar is tapped.
 *
 * Background is intentionally darker than the user app so admins feel
 * they're in a different mode (ops tool vs consumer app). Earth-palette
 * brand colors carry through so it still reads as the same product.
 */
export default function AdminLayout({ session, children }: AdminLayoutProps) {
  const reduceMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleLogout = () => {
    logout();
    // Hard reload so the auth gate in App.tsx re-runs getSession() from a
    // clean state. A SPA route change would be cleaner, but we'd need a
    // router; reload is one line and matches the demo-grade feel.
    window.location.reload();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: 'linear-gradient(180deg, #1B1411 0%, #2A201B 100%)',
          color: '#F9F2E4',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Mobile top bar */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            padding: '14px 18px',
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
            background: 'rgba(20, 14, 11, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(249, 242, 228, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              aria-hidden="true"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #D0AE92, #77574A)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                color: '#2E2522',
              }}
            >
              N
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F9F2E4', lineHeight: 1.1 }}>
                NutriVision Admin
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'rgba(249, 242, 228, 0.55)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginTop: 2,
                }}
              >
                Overview
              </div>
            </div>
          </div>

          <motion.button
            type="button"
            onClick={() => setNavOpen((s) => !s)}
            whileTap={{ scale: 0.94 }}
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={navOpen}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '7px 11px',
              borderRadius: 10,
              background: 'rgba(249, 242, 228, 0.08)',
              border: '1px solid rgba(249, 242, 228, 0.10)',
              color: '#F9F2E4',
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Menu
            <ChevronDown
              size={13}
              strokeWidth={2.5}
              style={{
                transform: navOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: reduceMotion ? undefined : 'transform 200ms ease',
              }}
            />
          </motion.button>
        </header>

        {/* Dropdown menu */}
        <AnimatePresence>
          {navOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              aria-label="Admin navigation"
              style={{
                padding: '8px 14px 12px',
                background: 'rgba(20, 14, 11, 0.95)',
                borderBottom: '1px solid rgba(249, 242, 228, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <NavLink icon={<LayoutDashboard size={14} />} label="Overview" active />
              <NavLink icon={<UsersIcon size={14} />} label="Users" disabled hint="Soon" />
              <NavLink icon={<Trophy size={14} />} label="Top foods" disabled hint="Soon" />
              <NavLink icon={<AlertTriangle size={14} />} label="Flagged queue" disabled hint="Soon" />

              <div
                style={{
                  marginTop: 8,
                  paddingTop: 10,
                  borderTop: '1px solid rgba(249, 242, 228, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#F9F2E4',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {session.email}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'rgba(249, 242, 228, 0.5)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginTop: 2,
                    }}
                  >
                    Admin
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Sign out"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 10px',
                    borderRadius: 10,
                    background: 'rgba(201, 98, 45, 0.18)',
                    border: '1px solid rgba(201, 98, 45, 0.32)',
                    color: '#F0B79A',
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={12} strokeWidth={2.5} />
                  Sign out
                </button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>

        {/* Main pane */}
        <main style={{ padding: '20px 18px 40px' }}>{children}</main>
      </div>
    );
  }

  // ── Desktop layout ───────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
        background: 'linear-gradient(180deg, #1B1411 0%, #2A201B 100%)',
        color: '#F9F2E4',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <aside
        style={{
          background: 'rgba(20, 14, 11, 0.65)',
          borderRight: '1px solid rgba(249, 242, 228, 0.06)',
          padding: '20px 16px 18px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          position: 'sticky',
          top: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #D0AE92, #77574A)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
              color: '#2E2522',
              boxShadow: '0 4px 12px -4px rgba(208, 174, 146, 0.45)',
            }}
          >
            N
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F9F2E4', lineHeight: 1.1 }}>
              NutriVision
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'rgba(249, 242, 228, 0.5)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              Admin
            </div>
          </div>
        </div>

        <nav aria-label="Admin sections" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavLink icon={<LayoutDashboard size={14} />} label="Overview" active />
          <NavLink icon={<UsersIcon size={14} />} label="Users" disabled hint="Soon" />
          <NavLink icon={<Trophy size={14} />} label="Top foods" disabled hint="Soon" />
          <NavLink icon={<AlertTriangle size={14} />} label="Flagged queue" disabled hint="Soon" />
        </nav>

        <div style={{ flex: 1 }} />

        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 14,
            background: 'rgba(249, 242, 228, 0.04)',
            border: '1px solid rgba(249, 242, 228, 0.08)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(249, 242, 228, 0.85)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={session.email}
          >
            {session.email}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(249, 242, 228, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginTop: 2,
            }}
          >
            Signed in
          </div>
          <motion.button
            type="button"
            onClick={handleLogout}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            aria-label="Sign out of admin"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(201, 98, 45, 0.20)',
              border: '1px solid rgba(201, 98, 45, 0.36)',
              color: '#F0B79A',
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
              justifyContent: 'center',
              marginTop: 10,
            }}
          >
            <LogOut size={12} strokeWidth={2.5} />
            Sign out
          </motion.button>
        </div>
      </aside>

      <main
        style={{
          padding: '32px 40px 64px',
          minWidth: 0,
          maxWidth: 1200,
          width: '100%',
          margin: '0 auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}

// ── Local nav link ───────────────────────────────────────────────────────

function NavLink({
  icon,
  label,
  active,
  disabled,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '9px 12px',
        borderRadius: 10,
        background: active ? 'rgba(249, 242, 228, 0.10)' : 'transparent',
        border: active ? '1px solid rgba(249, 242, 228, 0.14)' : '1px solid transparent',
        color: active ? '#F9F2E4' : disabled ? 'rgba(249, 242, 228, 0.35)' : 'rgba(249, 242, 228, 0.65)',
        fontFamily: 'Inter',
        fontSize: 13,
        fontWeight: active ? 700 : 600,
        cursor: disabled ? 'not-allowed' : 'default',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            color: active ? '#D0AE92' : 'inherit',
          }}
        >
          {icon}
        </span>
        {label}
      </span>
      {hint && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'rgba(249, 242, 228, 0.45)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

// (No design-token import needed — admin theme is fully local to this
// component since the dark gradient is intentional differentiation from
// the user app's cream surface.)