import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { RequestAuthError, enforceRateLimit, requireAuthenticatedUser, requireVerifiedAppCheck } from '@/lib/server-auth';

function toBreweryKey(brewery: string) {
  return brewery.replace(/[/\\#%?]/g, '_').slice(0, 200);
}

export async function POST(request: NextRequest) {
  try {
    const token = await requireAuthenticatedUser(request);
    await requireVerifiedAppCheck(request);
    await enforceRateLimit({ key: `brewery-intros:request:${token.uid}`, limit: 20, windowMs: 10 * 60 * 1000 });

    const { brewery } = await request.json();
    const normalizedBrewery = typeof brewery === 'string' ? brewery.trim() : '';
    if (!normalizedBrewery) {
      return NextResponse.json({ error: 'Missing brewery' }, { status: 400 });
    }

    const breweryKey = toBreweryKey(normalizedBrewery);
    const db = getFirestore(getAdminApp());
    const introRef = db.collection('breweryIntros').doc(breweryKey);
    const introSnapshot = await introRef.get();
    if (introSnapshot.exists) {
      return NextResponse.json({ requested: false, exists: true });
    }

    const requestRef = db.collection('breweryIntroRequests').doc(breweryKey);
    await requestRef.set({
      brewery: normalizedBrewery,
      breweryKey,
      status: 'pending',
      requestedBy: token.uid,
      requestCount: FieldValue.increment(1),
      requestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastRequestedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ requested: true, exists: false });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: '酒造介紹請求失敗' }, { status: 500 });
  }
}