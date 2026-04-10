import { NextRequest } from 'next/server';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';

export class RequestAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'RequestAuthError';
    this.status = status;
  }
}

export async function requireAuthenticatedUser(request: NextRequest): Promise<DecodedIdToken> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new RequestAuthError('未授權', 401);
  }

  const idToken = authHeader.slice(7);

  try {
    return await getAuth(getAdminApp()).verifyIdToken(idToken);
  } catch {
    throw new RequestAuthError('身份驗證失敗', 401);
  }
}

export function hasAdminClaim(token: DecodedIdToken): boolean {
  return token.admin === true;
}

export async function requireAdminUser(request: NextRequest): Promise<DecodedIdToken> {
  const token = await requireAuthenticatedUser(request);
  if (!hasAdminClaim(token)) {
    throw new RequestAuthError('無管理員權限', 403);
  }
  return token;
}

export async function requireVerifiedAppCheck(request: NextRequest): Promise<void> {
  if (process.env.FIREBASE_APP_CHECK_ENFORCED !== 'true') {
    return;
  }

  const appCheckToken = request.headers.get('X-Firebase-AppCheck');
  if (!appCheckToken) {
    throw new RequestAuthError('缺少 App Check 驗證', 401);
  }

  try {
    await getAppCheck(getAdminApp()).verifyToken(appCheckToken);
  } catch {
    throw new RequestAuthError('App Check 驗證失敗', 401);
  }
}

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export async function enforceRateLimit({ key, limit, windowMs }: RateLimitOptions): Promise<void> {
  const db = getFirestore(getAdminApp());
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const safeKey = key.replace(/[^a-zA-Z0-9:_-]/g, '_');
  const docId = `${safeKey}:${bucket}`;
  const ref = db.collection('rateLimits').doc(docId);

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const expiresAt = new Date((bucket + 1) * windowMs).toISOString();

    if (!snapshot.exists) {
      tx.set(ref, {
        key: safeKey,
        count: 1,
        bucket,
        windowMs,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        expiresAt,
      });
      return;
    }

    const data = snapshot.data() as { count?: number };
    const count = typeof data.count === 'number' ? data.count : 0;
    if (count >= limit) {
      throw new RequestAuthError('請求過於頻繁，請稍後再試', 429);
    }

    tx.update(ref, {
      count: count + 1,
      updatedAt: new Date(now).toISOString(),
      expiresAt,
    });
  });
}