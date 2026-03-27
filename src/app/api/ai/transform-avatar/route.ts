import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const STYLE_PROMPTS: Record<string, string> = {
  '寫實': 'photorealistic portrait, professional photography style, high detail, natural lighting',
  '水彩': 'watercolor painting portrait, soft brushstrokes, delicate washes of color, artistic',
  '動漫': 'anime style portrait, clean line art, vibrant colors, Japanese animation aesthetic',
  '油畫': 'oil painting portrait, rich textures, classic fine art style, painterly brushwork',
  '賽博龐克': 'cyberpunk portrait, neon lights, futuristic, dark atmosphere, synthwave aesthetic',
  '日式版畫': 'Japanese woodblock print style, ukiyo-e inspired, bold outlines, flat colors',
};

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg', style } = await req.json();

    if (!imageBase64 || !style) {
      return NextResponse.json({ error: 'Missing imageBase64 or style' }, { status: 400 });
    }

    const stylePrompt = STYLE_PROMPTS[style] || style;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
    });

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType as string,
              data: imageBase64,
            }
          },
          {
            text: `Transform this portrait/avatar image into the following art style: ${stylePrompt}. 
Keep the person's face, features, and overall composition recognizable. 
Only output the styled image, no text.`
          }
        ]
      }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      } as any,
    });

    const parts = result.response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

    if (!imagePart?.inlineData) {
      return NextResponse.json({ error: 'No image returned from AI' }, { status: 500 });
    }

    return NextResponse.json({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
    });
  } catch (error: any) {
    console.error('Avatar transform error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to transform image' },
      { status: 500 }
    );
  }
}
