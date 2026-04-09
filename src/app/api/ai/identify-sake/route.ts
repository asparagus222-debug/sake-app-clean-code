import { NextRequest, NextResponse } from 'next/server';
import { identifySake } from '@/ai/flows/identify-sake-flow';
import { RequestAuthError, enforceRateLimit, requireAuthenticatedUser, requireVerifiedAppCheck } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    await requireVerifiedAppCheck(req);
    await enforceRateLimit({ key: `ai:identify-sake:${user.uid}`, limit: 8, windowMs: 10 * 60 * 1000 });
    const { photoDataUri, backPhotoDataUri } = await req.json();
    if (!photoDataUri) {
      return NextResponse.json({ error: 'photoDataUri is required' }, { status: 400 });
    }
    const result = await identifySake({ photoDataUri, ...(backPhotoDataUri ? { backPhotoDataUri } : {}) });
    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('identify-sake error:', error);
    return NextResponse.json({ error: error.message || 'AI 辨識失敗' }, { status: 500 });
  }
}
