import type { User } from 'firebase/auth';

export const AUTH_BOOTSTRAP_STORAGE_KEY = 'sake_auth_bootstrap';
export const AUTH_BOOTSTRAP_COOKIE_NAME = 'sake_auth_bootstrap';
const AUTH_BOOTSTRAP_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type AuthBootstrapSnapshot = {
  uid: string;
  isAnonymous: boolean;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
  updatedAt: string;
};

type BootstrapProfileLike = {
  username?: string | null;
  avatarUrl?: string | null;
};

function parseSnapshot(raw: string | null | undefined): AuthBootstrapSnapshot | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<AuthBootstrapSnapshot>;
    if (!parsed || typeof parsed.uid !== 'string' || typeof parsed.isAnonymous !== 'boolean') {
      return null;
    }

    return {
      uid: parsed.uid,
      isAnonymous: parsed.isAnonymous,
      email: typeof parsed.email === 'string' || parsed.email === null ? parsed.email ?? null : null,
      username: typeof parsed.username === 'string' || parsed.username === null ? parsed.username ?? null : null,
      avatarUrl: typeof parsed.avatarUrl === 'string' || parsed.avatarUrl === null ? parsed.avatarUrl ?? null : null,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function serializeSnapshot(snapshot: AuthBootstrapSnapshot): string {
  return encodeURIComponent(JSON.stringify(snapshot));
}

export function createAuthBootstrapSnapshot(
  user: Pick<User, 'uid' | 'isAnonymous' | 'email'>,
  profile?: BootstrapProfileLike | null,
  previous?: AuthBootstrapSnapshot | null
): AuthBootstrapSnapshot {
  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    email: user.email ?? previous?.email ?? null,
    username: profile?.username ?? previous?.username ?? null,
    avatarUrl: profile?.avatarUrl ?? previous?.avatarUrl ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export function readAuthBootstrapFromStorage(): AuthBootstrapSnapshot | null {
  if (typeof window === 'undefined') return null;
  return parseSnapshot(window.localStorage.getItem(AUTH_BOOTSTRAP_STORAGE_KEY));
}

export function readAuthBootstrapFromCookieValue(value?: string | null): AuthBootstrapSnapshot | null {
  return parseSnapshot(value ?? null);
}

export function writeAuthBootstrap(snapshot: AuthBootstrapSnapshot): void {
  if (typeof window === 'undefined') return;

  const serialized = serializeSnapshot(snapshot);
  window.localStorage.setItem(AUTH_BOOTSTRAP_STORAGE_KEY, serialized);
  document.cookie = `${AUTH_BOOTSTRAP_COOKIE_NAME}=${serialized}; path=/; max-age=${AUTH_BOOTSTRAP_COOKIE_MAX_AGE}; samesite=lax`;
}

export function clearAuthBootstrap(): void {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(AUTH_BOOTSTRAP_STORAGE_KEY);
  document.cookie = `${AUTH_BOOTSTRAP_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}