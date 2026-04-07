import { NextRequest, NextResponse } from 'next/server';

/**
 * Cloud Vision API — WEB_DETECTION
 * 以圖片搜尋網路上的相關頁面與實體，用於酒標辨識試驗。
 * 使用 REST API，不需額外 SDK。
 * 需要 GOOGLE_CLOUD_VISION_API_KEY 環境變數（或 GEMINI_API_KEY 亦可，同 Google AI 金鑰）。
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

    return NextResponse.json({
      webEntities: annotation.webEntities || [],
      fullMatchingImages: annotation.fullMatchingImages || [],
      partialMatchingImages: annotation.partialMatchingImages || [],
      pagesWithMatchingImages: (annotation.pagesWithMatchingImages || []).slice(0, 10),
      bestGuessLabels: annotation.bestGuessLabels || [],
    });
  } catch (error: any) {
    console.error('[Vision API] unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Vision Web Detection 失敗' }, { status: 500 });
  }
}
