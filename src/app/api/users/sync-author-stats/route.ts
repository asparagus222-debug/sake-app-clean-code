import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { RequestAuthError, enforceRateLimit, requireAuthenticatedUser, requireVerifiedAppCheck } from '@/lib/server-auth';

async function syncAuthorStatsForUser(targetUid: string) {
  const db = getFirestore(getAdminApp());
  const notesSnapshot = await db.collection('sakeTastingNotes').where('userId', '==', targetUid).get();

  const noteCount = notesSnapshot.size;
  const likesReceivedCount = notesSnapshot.docs.reduce((total, noteDoc) => {
    const likesCount = noteDoc.data().likesCount;
    return total + (typeof likesCount === 'number' ? likesCount : 0);
  }, 0);

  const authorStats = {
    noteCount,
    likesReceivedCount,
    updatedAt: new Date().toISOString(),
  };

  await db.collection('users').doc(targetUid).set({ authorStats }, { merge: true });
  return authorStats;
}

export async function POST(request: NextRequest) {
  try {
    const token = await requireAuthenticatedUser(request);
    await requireVerifiedAppCheck(request);
    await enforceRateLimit({ key: `users:sync-author-stats:${token.uid}`, limit: 20, windowMs: 10 * 60 * 1000 });

    const body = await request.json().catch(() => ({}));
    const requestedUid = typeof body?.targetUid === 'string' ? body.targetUid.trim() : '';
    const targetUid = requestedUid || token.uid;

    if (targetUid !== token.uid && token.admin !== true) {
      throw new RequestAuthError('無權同步其他作者統計', 403);
    }

    const authorStats = await syncAuthorStatsForUser(targetUid);
    return NextResponse.json({ authorStats });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: '同步作者統計失敗' }, { status: 500 });
  }
}