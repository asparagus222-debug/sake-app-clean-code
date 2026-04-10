import { NextRequest, NextResponse } from 'next/server';
import { identifySake } from '@/ai/flows/identify-sake-flow';
import { RequestAuthError, enforceRateLimit, requireAuthenticatedUser, requireVerifiedAppCheck } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const requestStart = performance.now();
  try {
    const authStart = performance.now();
    const user = await requireAuthenticatedUser(req);
    await requireVerifiedAppCheck(req);
    await enforceRateLimit({ key: `ai:identify-sake:${user.uid}`, limit: 8, windowMs: 10 * 60 * 1000 });
    const authMs = Math.round((performance.now() - authStart) * 10) / 10;

    const payloadStart = performance.now();
    const { photoDataUri, backPhotoDataUri } = await req.json();
    const payloadMs = Math.round((performance.now() - payloadStart) * 10) / 10;
    if (!photoDataUri) {
      return NextResponse.json({ error: 'photoDataUri is required' }, { status: 400 });
    }

    const identifyStart = performance.now();
    const result = await identifySake({ photoDataUri, ...(backPhotoDataUri ? { backPhotoDataUri } : {}) });
    const identifyMs = Math.round((performance.now() - identifyStart) * 10) / 10;
    const totalMs = Math.round((performance.now() - requestStart) * 10) / 10;
    const timingPayload = { authMs, payloadMs, identifyMs, totalMs };

    return NextResponse.json(result, {
      headers: {
        'x-identify-sake-timing': JSON.stringify(timingPayload),
        'server-timing': `auth;dur=${authMs}, payload;dur=${payloadMs}, identify;dur=${identifyMs}, total;dur=${totalMs}`,
      },
    });
  } catch (error: any) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('identify-sake error:', error);
    return NextResponse.json({ error: error.message || 'AI 辨識失敗' }, { status: 500 });
  }
}
