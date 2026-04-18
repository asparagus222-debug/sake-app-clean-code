import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RequestAuthError, enforceRateLimit, requireAuthenticatedUser, requireVerifiedAppCheck } from '@/lib/server-auth';
import { cleanSakeName, inferOriginFromSakeInfo } from '@/lib/sake-data';

/**
 * Cloud Vision API — TEXT_DETECTION + WEB_DETECTION（單一請求）+ Gemini 萃取
 * Step 1: 一次 Vision 呼叫同時取得 OCR 文字 + 以圖搜圖結果
 * Step 2: Gemini Flash 結合兩組資訊萃取銘柄/酒造/產地/酒精濃度
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
    const user = await requireAuthenticatedUser(req);
    await requireVerifiedAppCheck(req);
    await enforceRateLimit({ key: `ai:vision-web-detect:${user.uid}`, limit: 10, windowMs: 10 * 60 * 1000 });
    const { photoDataUri } = await req.json();
    if (!photoDataUri) {
      return NextResponse.json({ error: 'photoDataUri is required' }, { status: 400 });
    }

    const visionKey = process.env.GOOGLE_CLOUD_VISION_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!visionKey) {
      return NextResponse.json({ error: 'Google API key not configured (set GOOGLE_CLOUD_VISION_API_KEY)' }, { status: 500 });
    }

    const base64 = photoDataUri.replace(/^data:image\/\w+;base64,/, '');

    // ── Step 1: 單一 Vision 請求，同時做 OCR + WEB_DETECTION ──
    const body = {
      requests: [
        {
          image: { content: base64 },
          features: [
            { type: 'DOCUMENT_TEXT_DETECTION' },   // 完整 OCR（比 TEXT_DETECTION 更適合印刷體）
            { type: 'WEB_DETECTION', maxResults: 20 },
          ],
        },
      ],
    };

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
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
    const visionResponse = json.responses?.[0];
    const annotation = visionResponse?.webDetection as WebDetectionResult | undefined;
    const ocrText: string = visionResponse?.fullTextAnnotation?.text || '';

    if (!annotation && !ocrText) {
      return NextResponse.json({ error: 'No results returned from Vision API' }, { status: 500 });
    }

    const visionData = {
      ocrText,
      webEntities: annotation?.webEntities || [],
      fullMatchingImages: annotation?.fullMatchingImages || [],
      partialMatchingImages: annotation?.partialMatchingImages || [],
      pagesWithMatchingImages: (annotation?.pagesWithMatchingImages || []).slice(0, 10),
      bestGuessLabels: annotation?.bestGuessLabels || [],
    };

    // ── Step 2: Gemini Flash 結合 OCR + Web 資訊萃取欄位 ──
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    let extracted: { brandName: string; brewery: string; origin: string; alcoholPercent: string } | null = null;

    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        const entitiesText = visionData.webEntities
          .filter(e => e.description)
          .map(e => `${e.description}（${(e.score * 100).toFixed(0)}%）`)
          .join('、');
        const labelsText = visionData.bestGuessLabels.map(l => l.label).join('、');
        const pageTitles = visionData.pagesWithMatchingImages
          .map(p => p.pageTitle).filter(Boolean).slice(0, 6).join('\n');

        const prompt = `你是清酒資料庫專家。以下是對一張清酒酒標圖片的分析結果，包含 OCR 文字和以圖搜圖資料。
請綜合判斷，萃取這款酒的基本資料，回傳純 JSON（不要 markdown）。

【OCR 辨識文字】
${ocrText || '（無）'}

【Best Guess Labels】${labelsText || '無'}
【Web Entities】${entitiesText || '無'}
【相關網頁標題】
${pageTitles || '無'}

規則：
1. 銘柄優先從 OCR 文字中找，再參考 Web Entities 確認
2. 酒精濃度從 OCR 文字讀取（格式如「16度」「16%」）
3. 若已能明確確認酒造，且相關網頁標題或常識足以確定酒造所在地，origin 可回填對應縣名
4. 只有在銘柄、酒造與產地都無法明確確認時，才把欄位留空，不要亂猜
5. 保持日文原文

{"brandName":"","brewery":"","origin":"","alcoholPercent":""}`;

        const result = await model.generateContent(prompt);
        const raw = result.response.text().trim().replace(/^```json\n?|```$/g, '').trim();
        const parsed = JSON.parse(raw) as { brandName?: string; brewery?: string; origin?: string; alcoholPercent?: string };
        const brandName = cleanSakeName(parsed.brandName || '');
        const brewery = cleanSakeName(parsed.brewery || '');
        const origin = cleanSakeName(parsed.origin || '') || inferOriginFromSakeInfo(brandName, brewery);
        const alcoholPercent = cleanSakeName(parsed.alcoholPercent || '');

        extracted = {
          brandName,
          brewery,
          origin,
          alcoholPercent,
        };
      } catch (e) {
        console.error('[Vision→Gemini] extraction failed:', e);
      }
    }

    return NextResponse.json({ ...visionData, extracted });
  } catch (error: any) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Vision API] unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Vision Web Detection 失敗' }, { status: 500 });
  }
}
