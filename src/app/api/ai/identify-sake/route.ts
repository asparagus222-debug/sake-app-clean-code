import { NextRequest, NextResponse } from 'next/server';
import { identifySake } from '@/ai/flows/identify-sake-flow';

export async function POST(req: NextRequest) {
  try {
    const { photoDataUri, backPhotoDataUri } = await req.json();
    if (!photoDataUri) {
      return NextResponse.json({ error: 'photoDataUri is required' }, { status: 400 });
    }
    const result = await identifySake({ photoDataUri, ...(backPhotoDataUri ? { backPhotoDataUri } : {}) });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('identify-sake error:', error);
    return NextResponse.json({ error: error.message || 'AI 辨識失敗' }, { status: 500 });
  }
}
