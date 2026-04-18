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

type VisionGuessLabel = {
  label?: string;
};

type AnalyzedImage = {
  ocrText: string;
  lines: string[];
  webEntities: VisionEntity[];
  pagesWithMatchingImages: VisionPage[];
  bestGuessLabels: VisionGuessLabel[];
  role: 'front' | 'back';
};

type BrandObservation = {
  value: string;
  normalized: string;
  score: number;
  sourceType: 'ocr-front' | 'ocr-back' | 'web' | 'page' | 'guess';
  imageIndex: number;
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

const BACK_LABEL_PATTERNS = [
  /原材料/i,
  /精米歩合/i,
  /アルコール/i,
  /日本酒度/i,
  /酸度/i,
  /アミノ酸/i,
  /内容量/i,
  /要冷蔵/i,
  /製造者/i,
  /製造元/i,
  /醸造元/i,
  /発売元/i,
  /使用米/i,
  /保存/i,
  /杜氏/i,
  /麹/i,
  /掛米/i,
];

const BREWERY_CAPTURE_PATTERN = /((?:株式会社|有限会社|合名会社|合資会社)?\s*[^\s:：]{1,20}?(?:酒造店|酒造|醸造店|醸造))/u;

function normalizeLine(line: string) {
  return line.replace(/[|｜]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeCandidateForCompare(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[\s・･·.,，、。()（）［］【】「」『』'"“”‘’]/g, '')
    .trim();
}

function hasJapaneseText(value: string) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value);
}

function isBrandCandidate(line: string) {
  if (!line || line.length < 2 || line.length > 24) return false;
  if (!hasJapaneseText(line)) return false;
  if (BACK_LABEL_PATTERNS.some((pattern) => pattern.test(line))) return false;
  if (BRAND_SKIP_PATTERNS.some((pattern) => pattern.test(line))) return false;
  if (BREWERY_CAPTURE_PATTERN.test(line)) return false;
  return true;
}

function extractLines(ocrText: string) {
  return ocrText
    .split(/\n+/)
    .map(normalizeLine)
    .filter(Boolean);
}

function cleanWebCandidate(value: string) {
  return value
    .replace(/\s*[|｜].*$/, '')
    .replace(/\s*[\-ー].*$/, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/日本酒/g, '')
    .replace(/清酒/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanBreweryCandidate(value: string) {
  const cleaned = normalizeLine(value)
    .replace(/^.*?(?:製造者|製造元|醸造元|発売元|製造場)\s*[:：]?[\s]*/u, '')
    .replace(/^(?:株式会社|有限会社|合名会社|合資会社)\s*/u, '')
    .replace(/\s*(?:株式会社|有限会社|合名会社|合資会社)$/u, '')
    .trim();

  const matched = cleaned.match(BREWERY_CAPTURE_PATTERN);
  return matched?.[1]?.trim() || cleaned;
}

function getFrontBackScores(lines: string[], webEntities: VisionEntity[], bestGuessLabels: VisionGuessLabel[]) {
  const backKeywordCount = lines.reduce((count, line) => count + (BACK_LABEL_PATTERNS.some((pattern) => pattern.test(line)) ? 1 : 0), 0);
  const highConfidenceWebHits = webEntities.filter((entity) => (entity.score || 0) >= 0.72 && isBrandCandidate(cleanWebCandidate(entity.description || ''))).length;
  const guessHits = bestGuessLabels.filter((label) => isBrandCandidate(cleanWebCandidate(label.label || ''))).length;
  const shortBrandLikeLines = lines.filter((line) => isBrandCandidate(line) && line.length <= 10).length;
  const breweryLines = lines.filter((line) => BREWERY_CAPTURE_PATTERN.test(line)).length;

  const frontScore = highConfidenceWebHits * 3 + guessHits * 2 + Math.min(shortBrandLikeLines, 2) * 2 + (lines.length <= 8 ? 1 : 0);
  const backScore = backKeywordCount * 2 + (lines.length >= 10 ? 2 : 0) + (breweryLines > 0 ? 1 : 0);
  return { frontScore, backScore };
}

function levenshtein(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, (_, rowIndex) =>
    Array.from({ length: right.length + 1 }, (_, columnIndex) => (rowIndex === 0 ? columnIndex : columnIndex === 0 ? rowIndex : 0))
  );

  for (let rowIndex = 1; rowIndex <= left.length; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex <= right.length; columnIndex += 1) {
      const substitutionCost = left[rowIndex - 1] === right[columnIndex - 1] ? 0 : 1;
      matrix[rowIndex][columnIndex] = Math.min(
        matrix[rowIndex - 1][columnIndex] + 1,
        matrix[rowIndex][columnIndex - 1] + 1,
        matrix[rowIndex - 1][columnIndex - 1] + substitutionCost
      );
    }
  }

  return matrix[left.length][right.length];
}

function areCandidatesSimilar(left: string, right: string) {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.includes(right) || right.includes(left)) return true;
  if (Math.abs(left.length - right.length) > 2) return false;
  return levenshtein(left, right) <= 1;
}

function buildBrandObservations(images: AnalyzedImage[]) {
  const observations: BrandObservation[] = [];

  images.forEach((image, imageIndex) => {
    const ocrCandidates = image.lines.filter((line) => isBrandCandidate(line)).slice(0, image.role === 'front' ? 4 : 2);
    ocrCandidates.forEach((candidate, candidateIndex) => {
      observations.push({
        value: candidate,
        normalized: normalizeCandidateForCompare(candidate),
        score: (image.role === 'front' ? 88 : 42) - candidateIndex * 8,
        sourceType: image.role === 'front' ? 'ocr-front' : 'ocr-back',
        imageIndex,
      });
    });

    image.webEntities.filter((entity) => entity.description).slice(0, 8).forEach((entity, entityIndex) => {
      const value = cleanWebCandidate(entity.description || '');
      if (!isBrandCandidate(value)) return;
      observations.push({
        value,
        normalized: normalizeCandidateForCompare(value),
        score: 66 + Math.round((entity.score || 0) * 18) - entityIndex * 3,
        sourceType: 'web',
        imageIndex,
      });
    });

    image.pagesWithMatchingImages
      .map((page) => cleanWebCandidate(page.pageTitle || ''))
      .flatMap((title) => title.split(/[|｜\-ー]/).map(normalizeLine))
      .filter((segment) => isBrandCandidate(segment))
      .slice(0, 6)
      .forEach((segment, segmentIndex) => {
        observations.push({
          value: segment,
          normalized: normalizeCandidateForCompare(segment),
          score: 58 - segmentIndex * 3,
          sourceType: 'page',
          imageIndex,
        });
      });

    image.bestGuessLabels.map((label) => cleanWebCandidate(label.label || '')).filter((label) => isBrandCandidate(label)).slice(0, 3).forEach((label, labelIndex) => {
      observations.push({
        value: label,
        normalized: normalizeCandidateForCompare(label),
        score: 52 - labelIndex * 4,
        sourceType: 'guess',
        imageIndex,
      });
    });
  });

  return observations.filter((observation) => observation.normalized.length >= 2);
}

function pickBrandName(images: AnalyzedImage[]) {
  const observations = buildBrandObservations(images);
  if (observations.length === 0) return '';

  const clusters: BrandObservation[][] = [];
  observations.forEach((observation) => {
    const cluster = clusters.find((entries) => entries.some((entry) => areCandidatesSimilar(entry.normalized, observation.normalized)));
    if (cluster) {
      cluster.push(observation);
    } else {
      clusters.push([observation]);
    }
  });

  return clusters
    .map((cluster) => {
      const forms = new Map<string, { value: string; score: number; sources: Set<string> }>();
      cluster.forEach((entry) => {
        const form = forms.get(entry.normalized) || { value: entry.value, score: 0, sources: new Set<string>() };
        form.score += entry.score;
        form.sources.add(`${entry.sourceType}-${entry.imageIndex}`);
        if (entry.value.length > form.value.length) {
          form.value = entry.value;
        }
        forms.set(entry.normalized, form);
      });

      const bestForm = [...forms.values()].sort((left, right) => {
        return right.sources.size - left.sources.size || right.score - left.score || right.value.length - left.value.length;
      })[0];

      const sourceDiversity = new Set(cluster.map((entry) => entry.sourceType)).size;
      const frontContribution = cluster.filter((entry) => entry.sourceType === 'ocr-front' || entry.sourceType === 'web' || entry.sourceType === 'page').reduce((sum, entry) => sum + entry.score, 0);
      const totalScore = cluster.reduce((sum, entry) => sum + entry.score, 0);

      return {
        value: bestForm?.value || '',
        totalScore: totalScore + bestForm.sources.size * 35 + sourceDiversity * 22 + Math.min(frontContribution, 120),
      };
    })
    .sort((left, right) => right.totalScore - left.totalScore)[0]?.value || '';
}

function pickBrewery(images: AnalyzedImage[]) {
  const ranked = new Map<string, number>();

  images.flatMap((image) =>
    image.lines
      .filter((line) => BREWERY_CAPTURE_PATTERN.test(line) || /(?:製造者|製造元|醸造元|発売元|製造場)/.test(line))
      .map((line) => cleanBreweryCandidate(line))
      .filter(Boolean)
  ).forEach((candidate, index) => {
    ranked.set(candidate, (ranked.get(candidate) || 0) + 100 - index * 8);
  });

  return [...ranked.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || '';
}

async function analyzeImage(photoDataUri: string): Promise<AnalyzedImage> {
  const visionKey = process.env.GOOGLE_CLOUD_VISION_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!visionKey) {
    throw new Error('Google API key not configured');
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
    throw new Error(`Vision API error: ${visionResponse.status} ${detail}`);
  }

  const visionJson = await visionResponse.json();
  const response = visionJson.responses?.[0];
  const ocrText = response?.fullTextAnnotation?.text || '';
  const lines = extractLines(ocrText);
  const webEntities = (response?.webDetection?.webEntities || []) as VisionEntity[];
  const pagesWithMatchingImages = (response?.webDetection?.pagesWithMatchingImages || []) as VisionPage[];
  const bestGuessLabels = (response?.webDetection?.bestGuessLabels || []) as VisionGuessLabel[];
  const { frontScore, backScore } = getFrontBackScores(lines, webEntities, bestGuessLabels);

  return {
    ocrText,
    lines,
    webEntities,
    pagesWithMatchingImages,
    bestGuessLabels,
    role: backScore > frontScore ? 'back' : 'front',
  };
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

    const payload = await req.json();
    const photoDataUris = Array.isArray(payload.photoDataUris)
      ? payload.photoDataUris.filter((item: unknown): item is string => typeof item === 'string' && item.length > 0).slice(0, 2)
      : typeof payload.photoDataUri === 'string' && payload.photoDataUri
        ? [payload.photoDataUri]
        : [];

    if (photoDataUris.length === 0) {
      return NextResponse.json({ error: 'photoDataUri or photoDataUris is required' }, { status: 400 });
    }

    const analyzedImages = await Promise.all(photoDataUris.map((photoDataUri: string) => analyzeImage(photoDataUri)));
    const brandName = pickBrandName(analyzedImages);
    const brewery = pickBrewery(analyzedImages);

    if (brandName || brewery) {
      return NextResponse.json({
        brandName,
        brewery,
        source: 'vision-lite',
        imageRoles: analyzedImages.map((image) => image.role),
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (!geminiKey) {
      return NextResponse.json({ brandName: '', brewery: '', source: 'vision-lite', imageRoles: analyzedImages.map((image) => image.role) });
    }

    const ocrText = analyzedImages.map((image, index) => `【圖片 ${index + 1} / ${image.role === 'front' ? '偏前標' : '偏背標'}】\n${image.ocrText || '無'}`).join('\n\n');
    const entitiesText = analyzedImages
      .flatMap((image) => image.webEntities)
      .filter((entity) => entity.description)
      .slice(0, 10)
      .map((entity) => `${entity.description} (${((entity.score || 0) * 100).toFixed(0)}%)`)
      .join('、');
    const pageTitles = analyzedImages
      .flatMap((image) => image.pagesWithMatchingImages)
      .map((page) => page.pageTitle)
      .filter(Boolean)
      .slice(0, 8)
      .join('\n');

    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      const result = await model.generateContent(`你是清酒酒標快速辨識助手。現在有最多兩張酒標圖片，順序不固定，可能是前標或背標。請根據 OCR 與以圖搜圖資訊，只回傳純 JSON，且只填兩個欄位：brandName、brewery。

規則：
1. 只抓銘柄與酒造，其他一律忽略
2. 兩張圖順序不代表前後標，要自行整合
3. brewery 只保留乾淨的酒造名稱，不要保留「製造者：」這類前綴
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
        brewery: cleanBreweryCandidate(extracted.brewery?.trim() || ''),
        source: 'gemini-lite',
        imageRoles: analyzedImages.map((image) => image.role),
      });
    } catch (error) {
      console.error('expo-quick-scan gemini fallback error:', error);
      return NextResponse.json({ brandName: '', brewery: '', source: 'vision-lite', imageRoles: analyzedImages.map((image) => image.role) });
    }
  } catch (error: any) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('expo-quick-scan error:', error);
    return NextResponse.json({ error: error.message || '快速掃圖失敗' }, { status: 500 });
  }
}