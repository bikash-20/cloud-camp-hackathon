import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { getSession, loginWithGoogle, logout } from './auth';
import * as storage from './storage';

const memStore = new Map<string, string>();
const mockStorage = {
  getItem: (k: string) => memStore.get(k) ?? null,
  setItem: (k: string, v: string) => memStore.set(k, String(v)),
  removeItem: (k: string) => {
    memStore.delete(k);
  },
  clear: () => memStore.clear(),
};

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
  });
});

describe('Authentication module (Real Google OAuth)', () => {
  beforeEach(() => {
    memStore.clear();
    storage.remove('auth');
    vi.restoreAllMocks();
  });

  it('restores null session when storage is empty', () => {
    expect(getSession()).toBeNull();
  });

  it('processes Google ID token and creates authenticated session via backend', async () => {
    const mockSession = {
      email: 'bikashtalukder040@gmail.com',
      role: 'admin',
      loginAt: '2026-10-31T01:00:00Z',
      name: 'Bikash Talukder',
      avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
      token: 'real-backend-jwt-token',
      sub: 'google-sub-12345',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          session: mockSession,
          token: 'real-backend-jwt-token',
          profile: { name: 'Bikash Talukder' },
        }),
    }) as unknown as typeof fetch;

    const session = await loginWithGoogle('valid-google-id-token');
    expect(session.email).toBe('bikashtalukder040@gmail.com');
    expect(session.name).toBe('Bikash Talukder');
    expect(session.role).toBe('admin');
    expect(session.token).toBe('real-backend-jwt-token');
    expect(getSession()?.email).toBe('bikashtalukder040@gmail.com');
  });

  it('clears session on logout', async () => {
    const mockSession = {
      email: 'user@gmail.com',
      role: 'user' as const,
      loginAt: '2026-10-31T01:00:00Z',
      name: 'User',
      avatarUrl: null,
      token: 'jwt-123',
    };
    storage.save('auth', mockSession);
    expect(getSession()).not.toBeNull();

    logout();
    expect(getSession()).toBeNull();
  });

  it('throws clear error if backend verification fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: 'Invalid or expired Google ID token.' }),
    }) as unknown as typeof fetch;

    await expect(loginWithGoogle('invalid-token')).rejects.toThrow(
      'Authentication error (401): Invalid or expired Google ID token.',
    );
  });
});
