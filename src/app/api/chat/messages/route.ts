import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { RequestAuthError, enforceRateLimit, requireAuthenticatedUser, requireVerifiedAppCheck } from '@/lib/server-auth';

const ANNOUNCEMENT_COOLDOWN_MS = 30 * 60 * 1000;

function normalizeInputText(input: unknown) {
  return typeof input === 'string' ? input.trim() : '';
}

export async function POST(request: NextRequest) {
  try {
    const token = await requireAuthenticatedUser(request);
    await requireVerifiedAppCheck(request);
    await enforceRateLimit({ key: `chat:message:${token.uid}`, limit: 40, windowMs: 10 * 60 * 1000 });

    const body = await request.json().catch(() => ({}));
    const rawText = normalizeInputText(body?.text);
    if (!rawText) {
      throw new RequestAuthError('訊息不可空白', 400);
    }

    const isAnnouncement = rawText.startsWith('!');
    const text = (isAnnouncement ? rawText.slice(1) : rawText).trim();
    if (!text) {
      throw new RequestAuthError('公告內容不可空白', 400);
    }

    const db = getFirestore(getAdminApp());
    const userRef = db.collection('users').doc(token.uid);
    const cooldownRef = db.collection('chatAnnouncementLimits').doc(token.uid);
    const messageRef = db.collection('chatMessages').doc();
    const now = new Date();
    const nowIso = now.toISOString();

    await db.runTransaction(async (tx) => {
      const [userSnapshot, cooldownSnapshot] = await Promise.all([
        tx.get(userRef),
        tx.get(cooldownRef),
      ]);

      if (isAnnouncement) {
        const lastAnnouncementAt = cooldownSnapshot.data()?.lastAnnouncementAt;
        const lastAnnouncementTs = typeof lastAnnouncementAt === 'string' ? new Date(lastAnnouncementAt).getTime() : 0;
        const diff = now.getTime() - lastAnnouncementTs;
        if (lastAnnouncementTs && diff < ANNOUNCEMENT_COOLDOWN_MS) {
          const remainMs = ANNOUNCEMENT_COOLDOWN_MS - diff;
          const remainMinutes = Math.ceil(remainMs / 60000);
          throw new RequestAuthError(`公告冷卻中，約 ${remainMinutes} 分鐘後可再使用`, 429);
        }
      }

      const profile = userSnapshot.data() as { username?: string; avatarUrl?: string } | undefined;
      const fallbackName = token.email?.split('@')[0] || '酒友';
      const username = profile?.username?.trim() || fallbackName;

      tx.set(messageRef, {
        userId: token.uid,
        username,
        avatarUrl: profile?.avatarUrl || '',
        text,
        messageType: isAnnouncement ? 'announcement' : 'message',
        createdAt: nowIso,
      });

      if (isAnnouncement) {
        tx.set(cooldownRef, {
          userId: token.uid,
          lastAnnouncementAt: nowIso,
          updatedAt: nowIso,
        }, { merge: true });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: '聊天室送出失敗' }, { status: 500 });
  }
}