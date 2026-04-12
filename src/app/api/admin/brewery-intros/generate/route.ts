import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { getAdminApp } from '@/lib/firebase-admin';
import { RequestAuthError, enforceRateLimit, requireAdminUser, requireVerifiedAppCheck } from '@/lib/server-auth';

function toBreweryKey(brewery: string) {
  return brewery.replace(/[/\\#%?]/g, '_').slice(0, 200);
}

async function generateIntro(brewery: string) {
  const response = await ai.generate({
    model: googleAI.model('gemini-flash-latest'),
    config: { googleSearchRetrieval: true },
    prompt: `請搜尋日本清酒酒造「${brewery}」的官方介紹與背景資料（優先參考官方網站）。整理成一篇 120～200 字的繁體中文短文，內容涵蓋：酒造創立背景、釀酒哲學或理念、代表性特色與釀造風格。請直接輸出文章內容，不需要標題、編號或任何格式符號。`,
  });

  return response.text?.trim() ?? '';
}

export async function POST(request: NextRequest) {
  try {
    const token = await requireAdminUser(request);
    await requireVerifiedAppCheck(request);
    await enforceRateLimit({ key: `admin:brewery-intros:generate:${token.uid}`, limit: 20, windowMs: 10 * 60 * 1000 });

    const { brewery } = await request.json();
    const normalizedBrewery = typeof brewery === 'string' ? brewery.trim() : '';
    if (!normalizedBrewery) {
      return NextResponse.json({ error: 'Missing brewery' }, { status: 400 });
    }

    const breweryKey = toBreweryKey(normalizedBrewery);
    const intro = await generateIntro(normalizedBrewery);
    if (!intro) {
      return NextResponse.json({ error: 'AI 未產生酒造介紹' }, { status: 502 });
    }

    const db = getFirestore(getAdminApp());
    await db.collection('breweryIntros').doc(breweryKey).set({
      brewery: normalizedBrewery,
      intro,
      generatedAt: new Date().toISOString(),
      generatedBy: token.uid,
      source: 'admin-ai',
    }, { merge: true });

    await db.collection('breweryIntroRequests').doc(breweryKey).set({
      brewery: normalizedBrewery,
      breweryKey,
      status: 'completed',
      completedAt: new Date().toISOString(),
      completedBy: token.uid,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ intro });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: '酒造介紹生成失敗' }, { status: 500 });
  }
}