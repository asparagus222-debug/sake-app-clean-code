import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { brandName, subBrand, brewery, origin, alcoholPercent, sakeInfoTags, ratings, tags, userDescription, mode } = await req.json();

    // 組合銘柄基本資料行
    const basicInfo = [
      brewery ? `酒造：${brewery}` : '',
      origin ? `產地：${origin}` : '',
      alcoholPercent ? `酒精：${alcoholPercent}` : '',
    ].filter(Boolean).join('　');

    // 組合特色標籤（sakeInfoTags + styleTags，去重）
    const allTags = [...new Set([...(sakeInfoTags ?? []), ...(tags ?? [])])];
    const tagsLine = allTags.length > 0 ? allTags.join('、') : '無';
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
若酒款有特色標籤（如大吟醸、無濾過、生原酒、特殊酒米、日本酒度等），可自然融入描述中增加說服力。
限制：只描述這款酒本身，絕對不可使用任何第二人稱（您、你、請您、邀請您等），不可對讀者說話；不可直接提及任何數字評分；不可提到餐搭、配食、任何食物。字數約 80 字，直接輸出文字，不要標題或 JSON。

【銘柄】${brandName}${subBrand ? `　${subBrand}` : ''}
【基本資料】${basicInfo || '無'}
【感官特徵】${flavorProfile}
【特色標籤】${tagsLine}
【作者筆記】${userDescription || '（無）'}`
      : `你是一位富有文學氣質的清酒品飲師。請針對以下資訊，撰寫一段充滿畫面感的感性品飲筆記。
可以聯想季節、風景、記憶或情境。若酒款有特殊標籤（如稀有酒米、特殊釀造法），可借助這些特色引發想像。字數約 80 字，直接輸出文字，不要標題或 JSON。

【銘柄】${brandName}${subBrand ? `　${subBrand}` : ''}
【基本資料】${basicInfo || '無'}
【感官特徵】${flavorProfile}
【特色標籤】${tagsLine}
【作者筆記】${userDescription || '（無）'}`;

    const result = await model.generateContent(prompt);
    return NextResponse.json({ text: result.response.text().trim() });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}