import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { RequestAuthError, enforceRateLimit, requireAuthenticatedUser, requireVerifiedAppCheck } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    await requireVerifiedAppCheck(req);
    await enforceRateLimit({ key: `ai:sake-summary:${user.uid}`, limit: 12, windowMs: 10 * 60 * 1000 });
    const { brewery } = await req.json();
    if (!brewery) return NextResponse.json({ error: 'Missing brewery' }, { status: 400 });

    const response = await ai.generate({
      model: googleAI.model('gemini-flash-latest'),
      config: { googleSearchRetrieval: true },
      prompt: `請搜尋日本清酒酒造「${brewery}」的官方介紹與背景資料（優先參考官方網站）。整理成一篇 120～200 字的繁體中文短文，內容涵蓋：酒造創立背景、釀酒哲學或理念、代表性特色與釀造風格。請直接輸出文章內容，不需要標題、編號或任何格式符號。`,
    });

    return NextResponse.json({ text: response.text?.trim() ?? '' });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
