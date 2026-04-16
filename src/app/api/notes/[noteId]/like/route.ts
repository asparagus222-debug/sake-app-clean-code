import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { isPublicPublishedNote } from '@/lib/note-lifecycle';
import { RequestAuthError, enforceRateLimit, requireAuthenticatedUser, requireVerifiedAppCheck } from '@/lib/server-auth';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ noteId: string }> }
) {
  try {
    const token = await requireAuthenticatedUser(request);
    await requireVerifiedAppCheck(request);
    await enforceRateLimit({ key: `notes:like:${token.uid}`, limit: 60, windowMs: 10 * 60 * 1000 });

    const { noteId } = await context.params;
    if (!noteId) {
      return NextResponse.json({ error: '缺少 noteId' }, { status: 400 });
    }

    const db = getFirestore(getAdminApp());
    const noteRef = db.collection('sakeTastingNotes').doc(noteId);
    let responsePayload = { liked: false, likesCount: 0 };

    await db.runTransaction(async (tx) => {
      const noteSnapshot = await tx.get(noteRef);
      if (!noteSnapshot.exists) {
        throw new RequestAuthError('筆記不存在', 404);
      }

      const noteData = noteSnapshot.data() as {
        userId?: string;
        likedByUserIds?: string[];
        likesCount?: number;
        entryMode?: string;
        visibility?: string;
        publicationStatus?: string;
      };
      if (!isPublicPublishedNote(noteData)) {
        throw new RequestAuthError('私人草稿不可按讚', 403);
      }
      const likedByUserIds = Array.isArray(noteData.likedByUserIds) ? noteData.likedByUserIds : [];
      const likesCount = typeof noteData.likesCount === 'number' ? noteData.likesCount : likedByUserIds.length;
      const authorUid = typeof noteData.userId === 'string' ? noteData.userId : '';
      const alreadyLiked = likedByUserIds.includes(token.uid);
      const nextLikesCount = alreadyLiked ? Math.max(0, likesCount - 1) : likesCount + 1;

      tx.update(noteRef, {
        likedByUserIds: alreadyLiked ? FieldValue.arrayRemove(token.uid) : FieldValue.arrayUnion(token.uid),
        likesCount: nextLikesCount,
      });

      if (authorUid) {
        tx.set(
          db.collection('users').doc(authorUid),
          {
            'authorStats.likesReceivedCount': FieldValue.increment(alreadyLiked ? -1 : 1),
            'authorStats.updatedAt': new Date().toISOString(),
          },
          { merge: true }
        );
      }

      responsePayload = {
        liked: !alreadyLiked,
        likesCount: nextLikesCount,
      };
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: '按讚失敗' }, { status: 500 });
  }
}