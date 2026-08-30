/**
 * Demo-grade auth module.
 *
 * Persists a lightweight session record under `nv_auth`. The password check
 * is intentionally trivial — any non-empty password matches a seeded
 * username — so the login flow feels real for the hackathon demo without
 * faking security. Replace with a real fetch() against your auth backend
 * (FastAPI/Auth0/Clerk) when shipping for real.
 *
 * Two seeded credentials are advertised on the login screen:
 *   admin@nutrivision.ai / admin123 → admin role
 *   user@nutrivision.ai  / user123  → regular user
 *
 * A previously-signed-in user is auto-restored on reload.
 */

import type { AuthSession, Role } from '../types/schemas';
import * as storage from './storage';

const SESSION_KEY = 'auth';

/**
 * Seeded account registry. The login screen reads from this list to decide
 * the role and to give visual feedback when an email doesn't match.
 *
 * In a real backend this would be a server-side user table. Keep it here
 * only because the demo's "password" check happens in the browser.
 */
export interface SeededAccount {
  email: string;
  role: Role;
  displayLabel: string;
  // Demo password advertised on the login screen.
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

/**
 * Attempt to sign in. Returns the new session on success, or null on a
 * bad email/password combination. Empty password is always rejected so
 * the form gives the user feedback when they hit Sign in too early.
 */
export async function login(email: string, password: string): Promise<AuthSession | null> {
  await new Promise((r) => setTimeout(r, 320)); // matches API client feel
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !password) return null;
  const account = SEEDED_ACCOUNTS.find((a) => a.email.toLowerCase() === trimmedEmail);
  if (!account) return null;
  // Demo-grade password check: any non-empty value matching the seeded
  // demoPassword is accepted. We don't accept arbitrary non-empty strings
  // because the login screen advertises the real seeded passwords — if
  // you mistype, the form should reject so it teaches the right creds.
  if (password !== account.demoPassword) return null;
  const session: AuthSession = {
    email: account.email,
    role: account.role,
    loginAt: new Date().toISOString(),
  };
  storage.save(SESSION_KEY, session);
  return session;
}

/** Clear the persisted session. Safe to call when no session exists. */
export function logout(): void {
  storage.remove(SESSION_KEY);
}