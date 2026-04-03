import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const ratingLabel = (val: number) => ['1', '2', '3', '4', '5'][val - 1] ?? String(val);

function buildSessionText(label: string, s: {
  sweetness: number; acidity: number; bitterness: number;
  umami: number; astringency: number; overallRating: number;
  userDescription?: string;
}) {
  return `【${label}】甜${ratingLabel(s.sweetness)} 酸${ratingLabel(s.acidity)} 苦${ratingLabel(s.bitterness)} 旨${ratingLabel(s.umami)} 澀${ratingLabel(s.astringency)} 綜合${s.overallRating}/10\n品飲筆記：${s.userDescription || '（無）'}`;
}

export async function POST(req: NextRequest) {
  try {
    const { brandName, session0, sessions } = await req.json();

    const allSessions: string[] = [
      buildSessionText(session0.label || '開瓶品飲', session0),
      ...((sessions || []) as Array<{
        label: string; sweetness: number; acidity: number; bitterness: number;
        umami: number; astringency: number; overallRating: number; userDescription?: string;
      }>).map((s) => buildSessionText(s.label, s)),
    ];

    const prompt = `你是一位資深唎酒師，正在分析一款清酒在開瓶後不同時間點的風味演變。
請根據以下多次品飲記錄，撰寫一段專業且有洞察力的「風味演變總結」。
重點描述：風味如何隨時間開放或收斂、哪個時間點最佳狀態、整體演變走向。
限制：不使用第二人稱、不提及餐搭、字數約 120 字，直接輸出文字，不要標題或 JSON。

【銘柄】${brandName}

${allSessions.join('\n\n')}`;

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const result = await model.generateContent(prompt);
    return NextResponse.json({ text: result.response.text().trim() });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
