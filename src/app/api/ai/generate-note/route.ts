import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { brandName, subBrand, brewery, origin, alcoholPercent, sakeInfoTags, ratings, userDescription, mode } = await req.json();

    // 組合銘柄基本資料行
    const basicInfo = [
      brewery ? `酒造：${brewery}` : '',
      origin ? `產地：${origin}` : '',
      alcoholPercent ? `酒精：${alcoholPercent}` : '',
    ].filter(Boolean).join('　');

    // 特色標籤只使用 sakeInfoTags（酒米、精米步合、日本酒度等客觀資訊）
    const tagsLine = (sakeInfoTags ?? []).length > 0 ? (sakeInfoTags as string[]).join('、') : '無';
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = mode === 'left'
      ? `你是一位資深唎酒師，正在撰寫這款清酒的品飲報告。
請根據以下感官特徵與作者筆記，客觀描述這款酒的特性，語氣專業自然。
若酒款有特色標籤（如大吟醸、無濾過、生原酒、特殊酒米、日本酒度等），可自然融入描述中增加說服力。
限制：只描述這款酒本身，絕對不可使用任何第二人稱（您、你、請您、邀請您等），不可對讀者說話；不可直接提及任何數字評分；不可提到餐搭、配食、任何食物。字數約 80 字，直接輸出文字，不要標題或 JSON。

【銘柄】${brandName}${subBrand ? `　${subBrand}` : ''}
【基本資料】${basicInfo || '無'}
【特色標籤】${tagsLine}
【作者筆記】${userDescription || '（無）'}`
      : `你是一位富有文學氣質的清酒品飲師。請針對以下資訊，撰寫一段充滿畫面感的感性品飲筆記。
可以聯想季節、風景、記憶或情境。若酒款有特殊標籤（如稀有酒米、特殊釀造法），可借助這些特色引發想像。字數約 80 字，直接輸出文字，不要標題或 JSON。

【銘柄】${brandName}${subBrand ? `　${subBrand}` : ''}
【基本資料】${basicInfo || '無'}
【特色標籤】${tagsLine}
【作者筆記】${userDescription || '（無）'}`;

    const result = await model.generateContent(prompt);
    return NextResponse.json({ text: result.response.text().trim() });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}