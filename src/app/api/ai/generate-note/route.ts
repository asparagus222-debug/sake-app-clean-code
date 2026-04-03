import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { brandName, subBrand, ratings, tags, userDescription, mode } = await req.json();
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const getRatingDesc = (key: string, val: number) => {
      const maps: Record<string, string[]> = {
        sweetness: ['極不甜','偏不甜','中等甜度','偏甜','極甜'],
        acidity: ['極低酸','低酸','中等酸度','高酸','极高酸'],
        bitterness: ['無苦味','微苦','中等苦味','偏苦','極苦'],
        umami: ['無旨味','微旨','中等旨味','旨味豐富','極豐旨味'],
        astringency: ['無澀感','微澀','中等澀感','偏澀','極澀'],
      };
      return maps[key]?.[val - 1] ?? '';
    };
    const flavorProfile = Object.entries(ratings as Record<string, number>)
      .map(([k, v]) => getRatingDesc(k, v)).filter(Boolean).join('、');

    const prompt = mode === 'left'
      ? `你是一位資深唎酒師，正在撰寫這款清酒的品飲報告。
請根據以下感官特徵與作者筆記，客觀描述這款酒的特性，語氣專業自然。
限制：只描述這款酒本身，絕對不可使用任何第二人稱（您、你、請您、邀請您等），不可對讀者說話；不可直接提及任何數字評分；不可提到餐搭、配食、任何食物。字數約 80 字，直接輸出文字，不要標題或 JSON。

【銘柄】${brandName}
【感官特徵】${flavorProfile}
【風格標籤】${tags.join('、') || '無'}
【作者筆記】${userDescription || '（無）'}`
      : `你是一位富有文學氣質的清酒品飲師。請針對以下資訊，撰寫一段充滿畫面感的感性品飲筆記。
可以聯想季節、風景、記憶或情境。字數約 80 字，直接輸出文字，不要標題或 JSON。

【銘柄】${brandName}
【感官特徵】${flavorProfile}
【風格標籤】${tags.join('、') || '無'}
【作者筆記】${userDescription || '（無）'}`;

    const result = await model.generateContent(prompt);
    return NextResponse.json({ text: result.response.text().trim() });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}