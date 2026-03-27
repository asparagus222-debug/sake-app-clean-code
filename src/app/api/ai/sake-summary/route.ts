import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { brandName, brewery, notes } = await req.json();
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const notesText = notes.map((n: { overallRating: number; tags?: string[]; description?: string }, i: number) =>
      `[${i + 1}] 評分${n.overallRating}/10${n.tags?.length ? '，標籤：' + n.tags.join('、') : ''}${n.description ? '，筆記：' + n.description.slice(0, 80) : ''}`
    ).join('\n');

    const prompt = `你是一位客觀的清酒評論家。根據以下${notes.length}篇品飲紀錄，為「${brandName}」（${brewery}）撰寫一段50字以內的客觀綜合評語，描述此酒的風味特色與整體印象。直接輸出評語文字，不需標題或格式。\n\n${notesText}`;

    const result = await model.generateContent(prompt);
    return NextResponse.json({ text: result.response.text().trim() });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
