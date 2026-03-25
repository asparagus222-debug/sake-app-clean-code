import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { brandName, subBrand, ratings, tags, userDescription, mode } = await req.json();
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const brainContext = mode === 'left' 
      ? "左腦品飲（分析與知識）：專注於邏輯、香氣辨識、構造與專業評分。" 
      : "右腦品飲（感受與想像）：專注於畫面感、直覺、情感與抽象聯想。";

    const prompt = `
      你是一位專業唎酒師。請針對以下資訊，撰寫一段「${mode === 'left' ? '左腦理性' : '右腦感性'}」的品飲筆記。
      
      【清酒資訊】銘柄:${brandName} ${subBrand}, 五味:${JSON.stringify(ratings)}, 標籤:${tags.join(', ')}
      【作者原始筆記】${userDescription || '（無提供，請根據規格發揮）'}

      【撰寫要求】
      1. ${brainContext}
      2. 字數約 80 字。
      3. 請直接輸出文字內容，不要包含任何標籤或 JSON。
    `;

    const result = await model.generateContent(prompt);
    return NextResponse.json({ text: result.response.text().trim() });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}