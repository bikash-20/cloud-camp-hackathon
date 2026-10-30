import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { getSession, login, loginWithDemo, loginWithGoogle, logout } from './auth';
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

describe('Authentication module (Google & Demo)', () => {
  beforeEach(() => {
    memStore.clear();
    storage.remove('auth');
    vi.restoreAllMocks();
  });

  it('restores null session when storage is empty', () => {
    expect(getSession()).toBeNull();
  });

  it('logs in with demo user account and persists session', async () => {
    const session = await loginWithDemo('user');
    expect(session.role).toBe('user');
    expect(session.email).toContain('nutrivision.ai');
    expect(getSession()).toEqual(session);
  });

  it('logs in with demo admin account and gives admin role', async () => {
    const session = await loginWithDemo('admin');
    expect(session.role).toBe('admin');
    expect(session.email).toBe('admin@nutrivision.ai');
    expect(getSession()?.role).toBe('admin');
  });

  it('processes Google ID token and creates authenticated session', async () => {
    const payload = {
      sub: 'google-sub-456',
      email: 'john.doe@gmail.com',
      name: 'John Doe',
      picture: 'https://lh3.googleusercontent.com/avatar.jpg',
    };
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const b64Payload = btoa(JSON.stringify(payload));
    const fakeIdToken = `${header}.${b64Payload}.signature`;

    const session = await loginWithGoogle(fakeIdToken);
    expect(session.email).toBe('john.doe@gmail.com');
    expect(session.name).toBe('John Doe');
    expect(session.role).toBe('user');
    expect(session.avatarUrl).toBe('https://lh3.googleusercontent.com/avatar.jpg');
    expect(session.token).toBe(fakeIdToken);
    expect(getSession()?.email).toBe('john.doe@gmail.com');
  });

  it('clears session on logout', async () => {
    await loginWithDemo('user');
    expect(getSession()).not.toBeNull();
    logout();
    expect(getSession()).toBeNull();
  });

  it('validates password correctly for seeded accounts', async () => {
    const success = await login('admin@nutrivision.ai', 'admin123');
    expect(success).not.toBeNull();
    expect(success?.role).toBe('admin');

    const failed = await login('admin@nutrivision.ai', 'wrong-pass');
    expect(failed).toBeNull();
  });
});
