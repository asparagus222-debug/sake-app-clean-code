import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RequestAuthError, enforceRateLimit, requireAuthenticatedUser, requireVerifiedAppCheck } from '@/lib/server-auth';

type VisionEntity = {
  description?: string;
  score?: number;
};

type VisionPage = {
  pageTitle?: string;
};

const BRAND_SKIP_PATTERNS = [
  /アルコール/i,
  /精米歩合/i,
  /原材料/i,
  /内容量/i,
  /容量/i,
  /日本酒度/i,
  /酸度/i,
  /アミノ酸/i,
  /製造/i,
  /年月/i,
  /JAN/i,
  /要冷蔵/i,
  /生酒/i,
  /清酒/i,
  /日本酒/i,
  /国税庁/i,
  /飲酒/i,
  /妊娠/i,
  /お酒/i,
  /ml$/i,
  /%$/i,
  /度$/i,
  /^〒/,
  /^TEL/i,
  /^[0-9０-９\-]+$/,
];

const BREWERY_PATTERNS = [
  /.+(?:酒造|酒造店|醸造|醸造店)$/,
  /.+(?:株式会社|有限会社|合名会社|合資会社).+/,
  /.+(?:本店|商店|店)$/,
];

function normalizeLine(line: string) {
  return line.replace(/[|｜]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasJapaneseText(value: string) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value);
}

function isBrandCandidate(line: string) {
  if (!line || line.length < 2 || line.length > 24) return false;
  if (!hasJapaneseText(line)) return false;
  if (BREWERY_PATTERNS.some((pattern) => pattern.test(line))) return false;
  if (BRAND_SKIP_PATTERNS.some((pattern) => pattern.test(line))) return false;
  return true;
}

function extractLines(ocrText: string) {
  return ocrText
    .split(/\n+/)
    .map(normalizeLine)
    .filter(Boolean);
}

function pickBrandFromOcr(lines: string[]) {
  return lines.find((line) => isBrandCandidate(line)) || '';
}

function pickBreweryFromOcr(lines: string[]) {
  return lines.find((line) => BREWERY_PATTERNS.some((pattern) => pattern.test(line))) || '';
}

function cleanWebCandidate(value: string) {
  return value
    .replace(/\s*[|｜].*$/, '')
    .replace(/\s*[-ー].*$/, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickBrandFromWeb(webEntities: VisionEntity[], pages: VisionPage[]) {
  const entityHit = webEntities
    .filter((entity) => (entity.score || 0) >= 0.7 && entity.description)
    .map((entity) => cleanWebCandidate(entity.description || ''))
    .find((entity) => isBrandCandidate(entity));

  if (entityHit) return entityHit;

  return pages
    .map((page) => cleanWebCandidate(page.pageTitle || ''))
    .flatMap((title) => title.split(/[|｜\-ー]/).map(normalizeLine))
    .find((segment) => isBrandCandidate(segment)) || '';
}

function parseJsonObject(rawText: string) {
  const trimmed = rawText.trim().replace(/^```json\n?|```$/g, '').trim();
  return JSON.parse(trimmed);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    await requireVerifiedAppCheck(req);
    await enforceRateLimit({ key: `ai:expo-quick-scan:${user.uid}`, limit: 12, windowMs: 10 * 60 * 1000 });

    const { photoDataUri } = await req.json();
    if (!photoDataUri) {
      return NextResponse.json({ error: 'photoDataUri is required' }, { status: 400 });
    }

    const visionKey = process.env.GOOGLE_CLOUD_VISION_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!visionKey) {
      return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
    }

    const base64 = photoDataUri.replace(/^data:image\/\w+;base64,/, '');
    const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [
            { type: 'DOCUMENT_TEXT_DETECTION' },
            { type: 'WEB_DETECTION', maxResults: 10 },
          ],
        }],
      }),
    });

    if (!visionResponse.ok) {
      const detail = await visionResponse.text();
      return NextResponse.json({ error: `Vision API error: ${visionResponse.status}`, detail }, { status: visionResponse.status });
    }

    const visionJson = await visionResponse.json();
    const response = visionJson.responses?.[0];
    const ocrText = response?.fullTextAnnotation?.text || '';
    const webEntities = (response?.webDetection?.webEntities || []) as VisionEntity[];
    const pagesWithMatchingImages = (response?.webDetection?.pagesWithMatchingImages || []) as VisionPage[];
    const lines = extractLines(ocrText);

    const brandFromOcr = pickBrandFromOcr(lines);
    const breweryFromOcr = pickBreweryFromOcr(lines);
    const brandFromWeb = pickBrandFromWeb(webEntities, pagesWithMatchingImages);
    const brandName = brandFromOcr || brandFromWeb;
    const brewery = breweryFromOcr;

    if (brandName) {
      return NextResponse.json({
        brandName,
        brewery,
        source: 'vision-lite',
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (!geminiKey) {
      return NextResponse.json({ brandName: '', brewery: '', source: 'vision-lite' });
    }

    const entitiesText = webEntities
      .filter((entity) => entity.description)
      .slice(0, 8)
      .map((entity) => `${entity.description} (${((entity.score || 0) * 100).toFixed(0)}%)`)
      .join('、');
    const pageTitles = pagesWithMatchingImages
      .map((page) => page.pageTitle)
      .filter(Boolean)
      .slice(0, 6)
      .join('\n');

    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      const result = await model.generateContent(`你是清酒酒標快速辨識助手。請根據以下 OCR 與以圖搜圖資訊，只回傳純 JSON，且只填兩個欄位：brandName、brewery。

規則：
1. 只抓銘柄與酒造，其他一律忽略
2. brandName 優先找酒標上最像產品名稱的日文原文
3. brewery 只有在明確出現酒造名稱時才填，否則留空
4. 不確定就留空，不要猜
5. 回傳格式固定為 {"brandName":"","brewery":""}

【OCR】
${ocrText || '無'}

【Web Entities】
${entitiesText || '無'}

【相關頁面標題】
${pageTitles || '無'}`);

      const extracted = parseJsonObject(result.response.text()) as { brandName?: string; brewery?: string };
      return NextResponse.json({
        brandName: extracted.brandName?.trim() || '',
        brewery: extracted.brewery?.trim() || '',
        source: 'gemini-lite',
      });
    } catch (error) {
      console.error('expo-quick-scan gemini fallback error:', error);
      return NextResponse.json({ brandName: '', brewery: '', source: 'vision-lite' });
    }
  } catch (error: any) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('expo-quick-scan error:', error);
    return NextResponse.json({ error: error.message || '快速掃圖失敗' }, { status: 500 });
  }
}