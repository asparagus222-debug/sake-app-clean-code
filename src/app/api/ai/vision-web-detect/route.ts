import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Cloud Vision API — WEB_DETECTION + Gemini 萃取
 * Step 1: Cloud Vision WEB_DETECTION（以圖搜圖）
 * Step 2: Gemini Flash 從 web entities / page titles 萃取銘柄/酒造/產地/酒精濃度
 */

interface WebDetectionResult {
  webEntities: { entityId: string; score: number; description: string }[];
  fullMatchingImages: { url: string }[];
  partialMatchingImages: { url: string }[];
  pagesWithMatchingImages: { url: string; pageTitle: string; fullMatchingImages?: { url: string }[] }[];
  bestGuessLabels: { label: string; languageCode: string }[];
}

export async function POST(req: NextRequest) {
  try {
    const { photoDataUri } = await req.json();
    if (!photoDataUri) {
      return NextResponse.json({ error: 'photoDataUri is required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Google API key not configured (set GOOGLE_CLOUD_VISION_API_KEY)' }, { status: 500 });
    }

    // Strip the data URI prefix to get raw base64
    const base64 = photoDataUri.replace(/^data:image\/\w+;base64,/, '');
    const mimeMatch = photoDataUri.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const body = {
      requests: [
        {
          image: { content: base64 },
          features: [{ type: 'WEB_DETECTION', maxResults: 20 }],
          imageContext: {
            webDetectionParams: { includeGeoResults: false },
          },
        },
      ],
    };

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Vision API] error:', errText);
      return NextResponse.json({ error: `Vision API error: ${response.status}`, detail: errText }, { status: response.status });
    }

    const json = await response.json();
    const annotation = json.responses?.[0]?.webDetection as WebDetectionResult | undefined;

    if (!annotation) {
      return NextResponse.json({ error: 'No web detection result returned' }, { status: 500 });
    }

    const visionData = {
      webEntities: annotation.webEntities || [],
      fullMatchingImages: annotation.fullMatchingImages || [],
      partialMatchingImages: annotation.partialMatchingImages || [],
      pagesWithMatchingImages: (annotation.pagesWithMatchingImages || []).slice(0, 10),
      bestGuessLabels: annotation.bestGuessLabels || [],
    };

    // ── Step 2: Gemini Flash 從 Vision 結果萃取清酒欄位 ──
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    let extracted: { brandName: string; brewery: string; origin: string; alcoholPercent: string } | null = null;

    if (geminiKey && (visionData.webEntities.length > 0 || visionData.pagesWithMatchingImages.length > 0)) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        const entitiesText = visionData.webEntities
          .filter(e => e.description)
          .map(e => `${e.description}（信心 ${(e.score * 100).toFixed(0)}%）`)
          .join('、');
        const labelsText = visionData.bestGuessLabels.map(l => l.label).join('、');
        const pageTitles = visionData.pagesWithMatchingImages
          .map(p => p.pageTitle)
          .filter(Boolean)
          .slice(0, 8)
          .join('\n');

        const prompt = `你是清酒資料庫專家。以下是對一張清酒酒標圖片進行以圖搜圖後得到的 Google Cloud Vision 結果。
請根據這些資訊，推斷這款酒的基本資料，回傳 JSON。

【Best Guess Labels】${labelsText || '無'}
【Web Entities】${entitiesText || '無'}
【相關網頁標題】
${pageTitles || '無'}

請回傳以下格式（純 JSON，不要 markdown）：
{"brandName":"銘柄（日文原文，不確定填空字串）","brewery":"酒造（日文原文，不確定填空字串）","origin":"產地縣（日文原文，不確定填空字串）","alcoholPercent":"酒精濃度如 16度，不確定填空字串"}`;

        const result = await model.generateContent(prompt);
        const raw = result.response.text().trim().replace(/^```json\n?|```$/g, '').trim();
        extracted = JSON.parse(raw);
      } catch (e) {
        console.error('[Vision→Gemini] extraction failed:', e);
      }
    }

    return NextResponse.json({ ...visionData, extracted });
  } catch (error: any) {
    console.error('[Vision API] unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Vision Web Detection 失敗' }, { status: 500 });
  }
}
