/**
 * Authentication module supporting Google Identity Services (OAuth 2.0)
 * and seeded hackathon demo credentials.
 *
 * Persists a lightweight session record under `nv_auth`.
 * A previously-signed-in user is auto-restored on reload.
 */

import type { AuthSession, GoogleAuthResponse, Role } from '../types/schemas';
import * as storage from './storage';

const SESSION_KEY = 'auth';

const API_BASE: string = (
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE
    ? import.meta.env.VITE_API_BASE
    : 'http://localhost:8000'
).replace(/\/+$/, '');

export interface SeededAccount {
  email: string;
  role: Role;
  displayLabel: string;
  demoPassword: string;
}

export const SEEDED_ACCOUNTS: SeededAccount[] = [
  {
    email: 'admin@nutrivision.ai',
    role: 'admin',
    displayLabel: 'Admin',
    demoPassword: 'admin123',
  },
  {
    email: 'user@nutrivision.ai',
    role: 'user',
    displayLabel: 'User',
    demoPassword: 'user123',
  },
];

/** Returns the persisted session, or null if not signed in. */
export function getSession(): AuthSession | null {
  return storage.load<AuthSession>(SESSION_KEY);
}

/** Parse unverified JWT payload (used as reliable offline/fallback metadata). */
function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Sign in using Google ID token from Google Identity Services.
 * Hits backend `/api/auth/google` to verify against Google and receive
 * an authorized session. Falls back cleanly if backend is temporarily unreachable.
 */
export async function loginWithGoogle(idToken: string): Promise<AuthSession> {
  try {
    const resp = await fetch(`${API_BASE}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });

    if (resp.ok) {
      const data: GoogleAuthResponse = await resp.json();
      storage.save(SESSION_KEY, data.session);
      return data.session;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Backend Google verification unreachable, using client claims:', err);
  }

  // Graceful client-side fallback if backend is offline
  const claims = parseJwtPayload(idToken) || {};
  const email = String(claims.email || 'user@gmail.com').toLowerCase();
  const name = typeof claims.name === 'string' ? claims.name : email.split('@')[0];
  const picture = typeof claims.picture === 'string' ? claims.picture : null;
  const role: Role = email.includes('admin') ? 'admin' : 'user';

  const session: AuthSession = {
    email,
    role,
    loginAt: new Date().toISOString(),
    name,
    avatarUrl: picture,
    token: idToken,
    sub: typeof claims.sub === 'string' ? claims.sub : undefined,
  };

  storage.save(SESSION_KEY, session);
  return session;
}

/**
 * Sign in with a demo account (judges / instant test path).
 * Hits backend `/api/auth/demo` when available to sync server state.
 */
export async function loginWithDemo(role: Role = 'user'): Promise<AuthSession> {
  const fallbackEmail = role === 'admin' ? 'admin@nutrivision.ai' : 'user@nutrivision.ai';
  const fallbackName = role === 'admin' ? 'Admin NutriVision' : 'Demo Foodie';

  try {
    const resp = await fetch(`${API_BASE}/api/auth/demo?role=${role}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    if (resp.ok) {
      const data: GoogleAuthResponse = await resp.json();
      storage.save(SESSION_KEY, data.session);
      return data.session;
    }
  } catch {
    // Fall back to client storage
  }

  const session: AuthSession = {
    email: fallbackEmail,
    role,
    loginAt: new Date().toISOString(),
    name: fallbackName,
    avatarUrl: null,
    token: null,
    sub: `demo-${role}`,
  };
  storage.save(SESSION_KEY, session);
  return session;
}

/**
 * Legacy email/password login for demo forms.
 */
export async function login(email: string, password: string): Promise<AuthSession | null> {
  await new Promise((r) => setTimeout(r, 200));
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !password) return null;
  const account = SEEDED_ACCOUNTS.find((a) => a.email.toLowerCase() === trimmedEmail);
  if (!account) return null;
  if (password !== account.demoPassword) return null;

  return loginWithDemo(account.role);
}

/** Clear the persisted session. */
export function logout(): void {
  storage.remove(SESSION_KEY);
  if (typeof window !== 'undefined' && window.google?.accounts?.id?.disableAutoSelect) {
    try {
      window.google.accounts.id.disableAutoSelect();
    } catch {
      // ignore
    }
  }
}
