import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';

const ADMIN_EMAILS = ['asparagus222@gmail.com', 'admin@example.com'];
const STALE_DAYS = 7;

function isBlankUsername(value: unknown) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function getCandidateTimestamp(data: Record<string, unknown>) {
  const raw = (data.updatedAt || data.createdAt) as unknown;
  if (typeof raw !== 'string') return null;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? null : time;
}

export async function POST(request: NextRequest) {
  try {
    const { callerIdToken } = await request.json();

    if (!callerIdToken) {
      return NextResponse.json({ error: '缺少管理員驗證資訊' }, { status: 400 });
    }

    const adminApp = getAdminApp();
    const adminAuth = getAuth(adminApp);
    const adminDb = getFirestore(adminApp);

    let callerRecord;
    try {
      callerRecord = await adminAuth.verifyIdToken(callerIdToken);
    } catch {
      return NextResponse.json({ error: '身份驗證失敗' }, { status: 401 });
    }

    if (!callerRecord.email || !ADMIN_EMAILS.includes(callerRecord.email)) {
      return NextResponse.json({ error: '無管理員權限' }, { status: 403 });
    }

    const now = Date.now();
    const staleThreshold = now - STALE_DAYS * 24 * 60 * 60 * 1000;
    const usersSnapshot = await adminDb.collection('users').get();

    let scanned = 0;
    let deleted = 0;
    const skipped: string[] = [];

    for (const userDoc of usersSnapshot.docs) {
      scanned += 1;
      const data = userDoc.data() as Record<string, unknown>;

      if (!isBlankUsername(data.username)) continue;

      const candidateTimestamp = getCandidateTimestamp(data);
      if (!candidateTimestamp || candidateTimestamp > staleThreshold) continue;

      const sponsorTotal = typeof data.sponsorTotal === 'number' ? data.sponsorTotal : 0;
      if (sponsorTotal > 0) {
        skipped.push(`${userDoc.id}:sponsor`);
        continue;
      }

      const [noteSnapshot, reportSnapshot] = await Promise.all([
        adminDb.collection('sakeTastingNotes').where('userId', '==', userDoc.id).limit(1).get(),
        adminDb.collection('reports').where('userId', '==', userDoc.id).limit(1).get(),
      ]);

      if (!noteSnapshot.empty || !reportSnapshot.empty) {
        skipped.push(`${userDoc.id}:linked-data`);
        continue;
      }

      let isAnonymousLike = false;
      try {
        const authUser = await adminAuth.getUser(userDoc.id);
        isAnonymousLike = !authUser.email && authUser.providerData.length === 0;
      } catch (error: any) {
        if (error?.code === 'auth/user-not-found') {
          isAnonymousLike = true;
        } else {
          skipped.push(`${userDoc.id}:auth-check`);
          continue;
        }
      }

      if (!isAnonymousLike) {
        skipped.push(`${userDoc.id}:not-anonymous`);
        continue;
      }

      await adminDb.collection('users').doc(userDoc.id).delete();
      try {
        await adminAuth.deleteUser(userDoc.id);
      } catch (error: any) {
        if (error?.code !== 'auth/user-not-found') {
          throw error;
        }
      }
      deleted += 1;
    }

    return NextResponse.json({
      success: true,
      scanned,
      deleted,
      skippedCount: skipped.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || '清理失敗' }, { status: 500 });
  }
}