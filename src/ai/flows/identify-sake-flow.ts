'use server';
/**
 * @fileOverview 清酒酒標兩段式辨識 AI Agent。
 * Step 1: Gemini 純視覺 OCR — 若有背標優先辨識背標，再以正標補充。
 * Step 2: 精準 Google Search — 用 Step 1 提取到的正確日文名稱搜尋官方規格，補齊細節。
 */
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';

const IdentifySakeInputSchema = z.object({
  photoDataUri: z.string().describe(
    "A photo of a sake label, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
  backPhotoDataUri: z.string().optional().describe(
    "Optional back label photo, same format. When provided, both front and back labels will be analyzed together."
  ),
});
export type IdentifySakeInput = z.infer<typeof IdentifySakeInputSchema>;

const IdentifySakeOutputSchema = z.object({
  brandName: z.string().describe('完整銘柄名稱 (例如：十四代、新政 No.6、産土 Colors 陸羽132号) 請保持日文原文。'),
  subBrand: z.string().optional().describe('保留欄位。預設回傳空字串，請盡量把完整品名直接寫入 brandName。'),
  brewery: z.string().describe('酒造名稱 (例如：高木酒造) 請保持日文原文。'),
  origin: z.string().describe('產地縣市 (例如：山形県) 請保持日文原文。'),
  alcoholPercent: z.string().optional().describe('酒精濃度，格式如 "16度" 或 "16%"，若無則回傳空字串。'),
  seimaibuai: z.string().optional().describe('精米步合，格式如 "50%" 或 "50割"，若無則回傳空字串。'),
  riceName: z.string().optional().describe('使用酒米品種 (例如：山田錦、五百万石)，若無則回傳空字串。保持日文原文。'),
  specialProcess: z.array(z.string()).optional().describe('特殊製程標籤陣列，例如：["純米大吟醸","生原酒","無濾過"]，若無則回傳空陣列。保持日文原文。'),
  yeast: z.string().optional().describe('使用酵母，例如：卍酵母十五號、魉水酵母、宮城酵母、山形酵母少0l號，若無則回傳空字串。保持日文原文。'),
  smv: z.string().optional().describe('日本酒度 (SMV)，格式如 "+5" 或 "-3"，辛口為正值、甘口為負值。若無則回傳空字串。'),
});
export type IdentifySakeOutput = z.infer<typeof IdentifySakeOutputSchema>;

const ExactKeywordSearchSchema = IdentifySakeOutputSchema.extend({
  confidence: z.enum(['high', 'medium', 'low']).describe('只有在多個搜尋結果明確指向同一款酒時，才可標記為 high。'),
  matchedKeyword: z.string().describe('本次精準搜尋採用的關鍵字。'),
});

// Gemini 視覺提取 Schema
const VisionExtractionSchema = z.object({
  allText: z.array(z.string()).optional().describe('圖片上所有可見文字列表（用於備用搜尋）'),
  visualDescription: z.string().optional().describe('酒標構圖特徵：瓶身/標籤顏色、主要圖案（如山水、花、動物、幾何）、有無印章或特殊標記、筆觸風格（細緻/粗獷）'),
  brandName: z.string(),
  subBrand: z.string(),
  brewery: z.string(),
  origin: z.string(),
  alcoholPercent: z.string(),
  seimaibuai: z.string(),
  riceName: z.string(),
  specialProcess: z.array(z.string()),
  yeast: z.string(),
  smv: z.string(),
  searchQuery: z.string(),
});

export async function identifySake(input: IdentifySakeInput): Promise<IdentifySakeOutput> {
  return identifySakeFlow(input);
}

// ── Cloud Vision 預檢：OCR + WEB_DETECTION 合併為單次請求 ──
async function callCloudVision(base64: string): Promise<{
  ocrText: string;
  webEntities: Array<{ description?: string; score?: number }>;
  bestGuessLabel: string;
}> {
  const visionKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!visionKey || !base64) return { ocrText: '', webEntities: [], bestGuessLabel: '' };
  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
      {
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
      }
    );
    if (!res.ok) return { ocrText: '', webEntities: [], bestGuessLabel: '' };
    const data = await res.json();
    const r = data.responses?.[0];
    return {
      ocrText: r?.fullTextAnnotation?.text || '',
      webEntities: r?.webDetection?.webEntities || [],
      bestGuessLabel: r?.webDetection?.bestGuessLabels?.[0]?.label || '',
    };
  } catch {
    return { ocrText: '', webEntities: [], bestGuessLabel: '' };
  }
}

function extractDirectSearchCandidates(frontOcr: string, bestGuessLabel: string): string[] {
  const candidates: Array<{ value: string; score: number }> = [];
  const seen = new Set<string>();
  const stopwords = new Set(['JAPAN', 'SAKE', 'NIHONSHU', 'JUNMAI', 'GINJO', 'DAIGINJO']);

  const pushCandidate = (rawValue: string, score: number) => {
    const value = rawValue.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!value || seen.has(value)) return;
    if (stopwords.has(value.toUpperCase())) return;
    seen.add(value);
    candidates.push({ value, score });
  };

  const inspectText = (text: string, baseScore: number) => {
    text
      .split(/\n+/)
      .map(line => line.replace(/[|｜]/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .forEach(line => {
        if (/^[A-Z][A-Z0-9&-]{3,24}$/.test(line)) {
          pushCandidate(line, baseScore + 20);
        }

        line.split(/\s+/).forEach(token => {
          if (/^[A-Z][A-Z0-9&-]{3,24}$/.test(token)) {
            pushCandidate(token, baseScore + 10);
          }
        });
      });
  };

  inspectText(frontOcr, 100);
  inspectText(bestGuessLabel, 70);

  return candidates
    .sort((left, right) => right.score - left.score)
    .map(candidate => candidate.value)
    .slice(0, 3);
}

export const identifySakeFlow = ai.defineFlow(
  {
    name: 'identifySakeFlow',
    inputSchema: IdentifySakeInputSchema,
    outputSchema: IdentifySakeOutputSchema,
  },
  async (input) => {
    const flowStart = performance.now();
    const hasBackLabel = !!input.backPhotoDataUri;
    const logTiming = (path: string, details: Record<string, unknown>) => {
      console.info('[AI辨識後端計時]', JSON.stringify({
        path,
        totalMs: Math.round((performance.now() - flowStart) * 10) / 10,
        ...details,
      }));
    };

    // 合併標籤陣列，去重（圖片標籤在前）
    const mergeUnique = (img: string[], search: string[]) => [...new Set([...img, ...search])];

    // ── Step 0: Cloud Vision 快速預檢（OCR + WEB_DETECTION，約 0.5-1.5 秒）──
    // 正標送 WEB_DETECTION（外觀獨特，Google 圖片比對品牌最準）+ OCR 讀銘柄文字
    // 背標送 OCR（印刷文字清晰，讀規格數值）
    const frontBase64 = input.photoDataUri?.split(',')[1] || '';
    const backBase64 = hasBackLabel ? input.backPhotoDataUri!.split(',')[1] : '';
    const cloudVisionStart = performance.now();
    const [frontVision, backVision] = await Promise.all([
      callCloudVision(frontBase64),
      backBase64 ? callCloudVision(backBase64) : Promise.resolve({ ocrText: '', webEntities: [], bestGuessLabel: '' }),
    ]);
    const cloudVisionMs = Math.round((performance.now() - cloudVisionStart) * 10) / 10;
    const frontOcr = frontVision.ocrText;     // 正標 OCR：銘柄/品牌名
    const vWebEntities = frontVision.webEntities; // 正標 WEB_DETECTION：網路圖片比對品牌
    const vOcr = hasBackLabel ? backVision.ocrText : frontVision.ocrText; // 背標 OCR：規格數值

    // 篩選高信心實體（score > 0.65）：正標 WEB_DETECTION 比對到的品牌/酒名
    const highConfEntities = vWebEntities
      .filter(e => (e.score || 0) > 0.65 && e.description && (e.description as string).length > 1)
      .slice(0, 6)
      .map(e => e.description as string);
    const hasStrongWebHit = highConfEntities.length > 0;
    const directSearchCandidates = extractDirectSearchCandidates(frontOcr, frontVision.bestGuessLabel);

    console.log(`[AI辨識] Vision 預檢 ─ OCR:${vOcr.length}字, 高信心:${highConfEntities.join('|') || '無'}`);

    // ── Step 0.5: 前標高信心關鍵字先精準搜尋 ──
    // 針對 CHIMERA、VEGA 這類辨識度高的文字，先用「關鍵字 + 日本酒」直搜。
    // 若搜尋結果已高度一致，就直接採信，避免後續被電商混合摘要或知名酒造帶偏。
    if (!hasBackLabel && directSearchCandidates.length > 0) {
      console.log(`[AI辨識] 前置精準搜尋候選: ${directSearchCandidates.join(' | ')}`);
      const exactKeywordStart = performance.now();

      for (const candidate of directSearchCandidates.slice(0, 2)) {
        const exactQuery = `"${candidate}" 日本酒`;
        const { output: exactMatch } = await ai.generate({
          model: googleAI.model('gemini-flash-latest'),
          config: { googleSearchRetrieval: true },
          output: { schema: ExactKeywordSearchSchema },
          prompt: [{
            text: `你是清酒資料庫專家。請先用 Google Search 精準搜尋「${exactQuery}」，確認這是否已足以唯一指向某一款日本酒。

已知線索：
- 正標 OCR：${frontOcr || '無'}
- 圖像高信心比對：${highConfEntities.join('、') || '無'}

判斷規則：
1. 若多個搜尋結果明確指向同一款日本酒，confidence 才能是 high
2. 若搜尋結果只是在電商頁同時出現多款酒，或摘要混有其他商品，confidence 必須降為 medium 或 low
3. 若 candidate 是產品名的一部分，可回傳完整官方品名，例如「白木久 特別純米 CHIMERA」
4. brandName 必須直接填完整品名；subBrand 預設留空，不要主動拆成兩欄
5. 不可把圖片上沒有的其他知名銘柄或酒造代表品牌硬接到產品名後面
6. 若無法唯一確認，brandName / brewery / origin 可留空，confidence 請回 low
7. 所有文字保持日文原文，不要翻譯
8. 若品名裡出現像酒米名的字樣，也不可因為它看起來像酒米就從 brandName 移除；只有在資料明確同時標示使用米時，才另外填 riceName

請回傳 JSON。`,
          }],
        }).catch(() => ({ output: null }));

        if (exactMatch?.confidence === 'high' && exactMatch.brandName && exactMatch.brewery) {
          const exactKeywordMs = Math.round((performance.now() - exactKeywordStart) * 10) / 10;
          console.log(`[AI辨識] 前置精準搜尋命中 ✓ ${candidate} → ${exactMatch.brandName} / ${exactMatch.brewery}`);
          logTiming('exact-keyword-search-path', { cloudVisionMs, exactKeywordMs, candidate: exactMatch.matchedKeyword || candidate, hasBackLabel });
          return {
            brandName: exactMatch.brandName,
            subBrand: '',
            brewery: exactMatch.brewery,
            origin: exactMatch.origin || '',
            alcoholPercent: exactMatch.alcoholPercent || '',
            seimaibuai: exactMatch.seimaibuai || '',
            riceName: exactMatch.riceName || '',
            specialProcess: exactMatch.specialProcess || [],
            yeast: exactMatch.yeast || '',
            smv: exactMatch.smv || '',
          };
        }
      }

      console.log('[AI辨識] 前置精準搜尋未達高信心，回退至既有流程');
    }

    // ── 快速通道：WEB_DETECTION 高信心 + OCR 有文字 → 跳過 Google Search ──
    // 對常見知名清酒省下整個 ~6 秒的 Google Search 步驟
    if (hasStrongWebHit && vOcr.length > 20) {
      console.log('[AI辨識] 快速通道：Vision 識別成功 → Gemini 文字整合（跳過 Google Search）');
      const webSummary = highConfEntities.join('、');
      const fastPathStart = performance.now();
      const { output: fastResult } = await ai.generate({
        model: googleAI.model('gemini-flash-latest'),
        output: { schema: IdentifySakeOutputSchema },
        prompt: [{
          text: `你是清酒辨識專家。請結合以下資訊，填入完整的清酒規格。

【背標 OCR 文字（規格主要來源：酒精濃度、精米步合、使用米等）】
${vOcr}

${frontOcr ? `【正標 OCR 文字（銘柄/品牌名主要來源，如英文或藝術字銘柄）】
${frontOcr}

` : ''}【Google 以圖搜圖高信心比對結果（可輔助確認銘柄/酒造）】
${webSummary}

填寫規則：
1. 銘柄：優先從「正標 OCR」讀取（正標通常印有品牌名），若正標無明確銘柄再從背標或 Google 比對確認
2. 酒造：從背標 OCR 讀取，Google 比對可輔助確認
3. 酒精濃度、精米步合等數值：從背標 OCR 讀取（以背標為準，不可推測）
4. 若正標銘柄與背標資訊有矛盾，以背標明確印刷文字為準
5. 日本酒度 (SMV) 若 OCR 有印出（如「日本酒度 +5」「+3」「±0」），填入 smv 欄位
6. specialProcess：只填 OCR 或比對結果中明確出現的製法詞
7. 若正標上是獨立的英文字樣或系列名（例如 CHIMERA、VEGA），brandName 就只填該字樣本身，不可把 Google 比對到的其他代表銘柄或酒造品牌接在前後
8. 禁止自行拼接成圖片上不存在的新名稱；除非完整名稱逐字出現在標籤上，否則不可輸出像「A品牌 B系列」這種串接結果
9. 保持日文原文，不要翻譯`,
        }],
      }).catch(() => ({ output: null }));

      // brandName === brewery 代表沒找到真正銘柄，以酒造名頂替，視為失敗
      const isBrandSameAsBrewery = fastResult?.brandName && fastResult?.brandName === fastResult?.brewery;
      const fastPathMs = Math.round((performance.now() - fastPathStart) * 10) / 10;
      if (fastResult?.brandName && fastResult?.brewery && !isBrandSameAsBrewery) {
        console.log(`[AI辨識] 快速通道成功 ✓ ${fastResult.brandName} / ${fastResult.brewery}`);
        logTiming('vision-fast-path', { cloudVisionMs, fastPathMs, hasBackLabel });
        return fastResult;
      }
      if (isBrandSameAsBrewery) console.log('[AI辨識] 快速通道銘柄=酒造，疑似未找到真正銘柄，回退');
      console.log('[AI辨識] 快速通道萃取不完整，回退至標準流程');
    }

    // ── 快速路徑：有背標時，先純視覺 OCR，再補充搜尋，圖片數值絕對優先 ──
    if (hasBackLabel) {
      // Step A：若 Cloud Vision OCR 文字充足（背標印刷文字清晰），改用純文字 Gemini，比視覺呼叫快 ~2 秒
      // 否則回退至傳統視覺 OCR
      const useTextOcr = vOcr.length > 50;
      console.log(`[AI辨識] 快速路徑 Step A：${useTextOcr ? 'Cloud Vision 文字版（加速）' : '視覺版'} OCR`);
      const backOcrStart = performance.now();
      const { output: backOcr } = await ai.generate({
        model: googleAI.model('gemini-flash-latest'),
        output: { schema: IdentifySakeOutputSchema },
        prompt: useTextOcr ? [
          {
            text: `你是清酒酒標文字辨識專家。以下是 Cloud Vision OCR 分別從背標與正標讀取的完整文字：

【背標 OCR（規格主要來源）】
\`\`\`
${vOcr}
\`\`\`

${frontOcr ? `【正標 OCR（銘柄/品牌名來源）】
\`\`\`
${frontOcr}
\`\`\`

` : ''}請結合兩張標籤的資訊填入清酒規格。

⚠️ 重要規則：
- 銘柄：優先從正標 OCR 讀取（正標通常印有品牌名，如 VEGA、英文或書法字）
- 酒精濃度、精米步合、種別等規格數值：從背標 OCR 讀取，必須與文字完全一致，不可推測
- 若正標銘柄與背標資訊有矛盾，以背標明確印刷文字為準
- 日本酒度 (SMV) 若文字中有印出（如「日本酒度 +5」「+3」「±0」），請填入 smv 欄位
- 若正標上是清楚可讀的獨立英文字樣或系列名，brandName 只能填該字樣本身，不可另外補上酒造代表銘柄或系列母品牌
- 禁止把「酒造知名主牌」和「實際產品名」拼接成新名稱，除非完整字串真的印在標籤上
- 保持日文原文，不要翻譯`,
          },
          ...(input.photoDataUri ? [{ media: { url: input.photoDataUri, contentType: 'image/jpeg' } }] : []),
        ] : [
          {
            text: `你是清酒背標文字辨識專家。請仔細讀取圖片上所有印刷文字，逐字逐行填入對應欄位。

背標通常包含：銘柄（品牌名）、酒造名、産地、酒精濃度、精米步合、使用米、種別（純米吟醸／純米大吟醸等）、酵母

⚠️ 重要規則：
- 所有欄位請「100% 從圖片讀取」，不要推測或補充圖片上沒有的資訊
- 酒精濃度、精米步合、種別 必須與圖片文字完全一致，不可填入推測值
- 日本酒度 (SMV) 若標籤上有印出（如「日本酒度 +5」「+3」「±0」），請填入 smv 欄位
- 若有正標（第二張圖），可參考補充銘柄文字
- 保持日文原文，不要翻譯`,
          },
          { media: { url: input.backPhotoDataUri!, contentType: 'image/jpeg' } },
          ...(input.photoDataUri ? [{ media: { url: input.photoDataUri, contentType: 'image/jpeg' } }] : []),
        ],
      }).catch(() => ({ output: null }));

      const backOcrMs = Math.round((performance.now() - backOcrStart) * 10) / 10;
      if (backOcr?.brandName && backOcr?.brewery) {
        console.log('[AI辨識] 快速路徑 Step A 成功:', backOcr.brandName, '→ Step B 補充搜尋');

        // Step B：搜尋這款酒的補充製法資訊，嚴格要求有搜尋結果依據才能填入
        const supplementQuery = `"${backOcr.brandName}" "${backOcr.brewery}" 日本酒`;
        const supplementStart = performance.now();
        const { output: supplement } = await ai.generate({
          model: googleAI.model('gemini-flash-latest'),
          config: { googleSearchRetrieval: true },
          output: { schema: IdentifySakeOutputSchema },
          prompt: [{
            text: `你是清酒資料庫專家。請用 Google Search 精確搜尋「${supplementQuery}」，只查詢這款酒的官方資料。

已從圖片確認的資訊（禁止覆蓋）：
- 銘柄：${backOcr.brandName}
- 酒造：${backOcr.brewery}
- 酒精濃度：${backOcr.alcoholPercent}
- 精米步合：${backOcr.seimaibuai}
- 使用米：${backOcr.riceName}
- 種別：${JSON.stringify(backOcr.specialProcess || [])}

補充規則（非常嚴格）：
1. specialProcess 只能填入搜尋結果中「明確出現在這款酒產品頁」的製法標籤，例如：袋吊り、山廃、生酛、木桶仕込み、有機米使用
2. 受賞資訊（受賞酒、金賞等）除非搜尋結果明確指出是這瓶，否則不填
3. 酵母只填入搜尋結果中有明確資料的，不猜測地區酵母
4. 若搜尋結果沒有可靠的補充資訊，specialProcess 回傳空陣列，不要亂填
5. 保持日文原文，不要翻譯
6. 寧可少填，不要填入無法確認的資訊`,
          }],
        }).catch(() => ({ output: null }));

        // Step B 合併：圖片數值絕對優先，specialProcess 取聯集
        const supplementMs = Math.round((performance.now() - supplementStart) * 10) / 10;
        const mergedResult = {
          brandName: backOcr.brandName,
          subBrand: '',
          brewery: backOcr.brewery,
          origin: backOcr.origin || supplement?.origin || '',
          alcoholPercent: backOcr.alcoholPercent || '',
          seimaibuai: backOcr.seimaibuai || '',
          riceName: backOcr.riceName || '',
          specialProcess: mergeUnique(backOcr.specialProcess || [], supplement?.specialProcess || []),
          yeast: backOcr.yeast || supplement?.yeast || '',
          smv: backOcr.smv || supplement?.smv || '',
        };
        logTiming('back-label-fast-path', { cloudVisionMs, backOcrMs, supplementMs, hasBackLabel });
        return mergedResult;
      }
      console.log('[AI辨識] 快速路徑 OCR 未取得完整品牌資訊，回退至完整流程');
    }

    // ── Step 1: Gemini 純視覺 OCR ──
    // 若有背標，優先以背標作為主要辨識圖片（背標通常有清晰印刷文字）
    const primaryImage = hasBackLabel ? input.backPhotoDataUri! : input.photoDataUri;
    const secondaryImage = hasBackLabel ? input.photoDataUri : null;

    const step1Start = performance.now();
    const { output: geminiVision } = await ai.generate({
      model: googleAI.model('gemini-flash-latest'),
      output: { schema: VisionExtractionSchema },
      prompt: [
        {
          text: `你是日文清酒酒標的完整文字辨識專家。${hasBackLabel ? '我提供了背標（第一張）和正標（第二張）兩張圖片，背標有完整且清晰的印刷文字，請優先從背標讀取所有資訊（銘柄、酒造、規格等）。' : ''}

【第一步】列出圖片上「所有」可見文字。
【第二步】描述酒標視覺構圖：主色調、大型書道文字（直接寫出是哪個字，如「笑」「夢」「粋」）、有無印章、筆觸風格。
【第三步】從文字和視覺共同判斷完整銘柄，brandName 必須直接填完整品名，不要拆成多欄。
【第四步】產生包含「銘柄」+「酒造」+「日本酒」的 searchQuery（例如：「新政 No.6 新政酒造 日本酒」）。若圖中有多瓶酒，請辨識最清晰、標籤最完整的那一瓶。

⚠️ 重要：大型書道裝飾字不是銘柄；searchQuery 必須包含「日本酒」關鍵字，縮小搜尋至清酒領域。${hasBackLabel ? '\n- 第一張圖（背標）有完整印刷銘柄文字，請從背標讀取作為主要資訊來源' : ''}

請回傳 JSON（不加 markdown）：
{"allText":["所有可見文字"],"visualDescription":"視覺特徵含書道大字名稱","brandName":"完整銘柄","subBrand":"","brewery":"酒造","origin":"産地","alcoholPercent":"酒精濃度","seimaibuai":"精米步合","riceName":"使用米","specialProcess":["..."],"yeast":"使用酵母","searchQuery":"銘柄+酒造+日本酒"}`,
        },
        { media: { url: primaryImage, contentType: 'image/jpeg' } },
        ...(secondaryImage ? [{ media: { url: secondaryImage, contentType: 'image/jpeg' } }] : []),
      ],
    }).catch(() => ({ output: null }));

    const step1VisionMs = Math.round((performance.now() - step1Start) * 10) / 10;
    const vision = geminiVision ?? { allText: [], brandName: '', subBrand: '', brewery: '', origin: '', alcoholPercent: '', seimaibuai: '', riceName: '', specialProcess: [], searchQuery: '', yeast: '', smv: '', visualDescription: '' };

    const { brandName, brewery, origin } = vision;
    // 取出括號/空格前的「核心銘柄字串」做可疑判斷
    // 例：「子 (純米大吟醸)」→ core = "子"（單字，可疑）；「まるわらい」→ core = "まるわらい"（正常）
    // 常見裝飾漢字（書道大字）一律視為可疑，不論長短
    const DECORATIVE_KANJI = new Set(['笑', '夢', '粋', '縁', '楽', '誠', '心', '愛', '龍', '鶴', '宇', '字', '子', '幸', '福']);
    const brandNameCore = brandName.split(/[\s（(]/)[0].trim();
    // 單字「非漢字/假名」（如 OCR 誤讀成 "1"、"A"）視為可疑；合法的單字漢字銘柄（橘、颯 等）不觸發
    const isSingleNonCJK = brandNameCore.length === 1 && !/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(brandNameCore);
    const isSuspiciousBrand = !brandName
      || isSingleNonCJK
      || DECORATIVE_KANJI.has(brandNameCore);
    const allTextJoined = (vision.allText || []).join(' ');
    // isSuspiciousBrand 時：vision.searchQuery（含 Step 1 推斷的視覺關鍵詞）+ visualDescription（含書道大字名稱如「笑」）
    // 這樣能確保「笑 伝承乃技 純米大吟醸」進入 Google Search，找到 まるわらい 等用書道字命名的酒
    // 確保搜尋詞一定帶有「日本酒」，縮小搜尋範圍至清酒領域
    const appendSake = (q: string) => /日本酒|清酒/.test(q) ? q : `${q} 日本酒`;
    const searchQuery = isSuspiciousBrand
      ? appendSake([`${vision.searchQuery || ''}`, `${vision.visualDescription || ''}`].filter(Boolean).join(' ').trim())
      : appendSake(vision.searchQuery || `${brandName} ${brewery} 日本酒`);

    if (isSuspiciousBrand) {
      console.log(`[AI辨識] brandName "${brandName}" 疑為裝飾字，改用 allText 搜尋: ${searchQuery}`);
    }

    // 若品牌和酒造都無法辨識，直接回傳視覺結果（避免搜出無關結果）
    if (!brandName && !brewery && !isSuspiciousBrand) {
      const fallbackResult = {
        brandName: '',
        brewery: '',
        origin,
        alcoholPercent: vision.alcoholPercent || '',
        seimaibuai: vision.seimaibuai || '',
        riceName: vision.riceName || '',
        specialProcess: vision.specialProcess || [],
        yeast: vision.yeast || '',
        smv: vision.smv || '',
      };
      logTiming('vision-only-empty-fallback', { cloudVisionMs, step1VisionMs, hasBackLabel });
      return fallbackResult;
    }

    // ── Step 2: Google Search 補齊規格 ──
    // 用 Step 1 精確提取的日文名稱去搜尋，準確度遠高於直接用圖片搜尋。
    const query = searchQuery;

    const step2Start = performance.now();
    const { output: enriched } = await ai.generate({
      model: googleAI.model('gemini-flash-latest'),
      config: { googleSearchRetrieval: true },
      output: { schema: IdentifySakeOutputSchema },
      prompt: [
        {
          text: isSuspiciousBrand
        ? `你是清酒資料庫專家。請用 Google Search 搜尋「${query}」，找出這款日本酒的完整規格。

⚠️ 注意：這款酒的銘柄從圖片「無法確定」（圖片上只識別到書道裝飾字，非真正銘柄）。請「完全依據搜尋結果」判斷真正的銘柄和酒造。

圖片視覺描述：${vision.visualDescription || '未知'}
（提示：例如書道大字「笑（=わらい）」→ 銘柄「まるわらい（丸笑）」；「夢」一字 → 可搜尋「夢 純米大吟醸 日本酒」）

從圖片確認的參考資訊：
- 酒精濃度：${vision.alcoholPercent || '未知'}
- 精米步合：${vision.seimaibuai || '未知'}
- 使用米：${vision.riceName || '未知'}
- 特殊製程：${JSON.stringify(vision.specialProcess || [])}

請用 Google Search 查詢。回傳規則：
1. brandName 和 brewery 必須從搜尋結果確定，不可使用圖片疑似的書道字
2. 若搜尋結果不確定，brandName 填入空字串
3. 所有文字保持日文原文，不要翻譯
4. brandName 必須填完整品名，subBrand 留空
5. 就算品名裡含有像酒米名的字樣，也不要因此把它從 brandName 移除；只有在搜尋結果明確同時標示使用米時，才另外填 riceName
6. 若搜尋結果有酵母資訊（yeast欄位）請一並填入`
        : `你是清酒資料庫專家。請用 Google Search 搜尋「${query}」，找出這款日本酒的完整規格。

從酒標圖片已確認的資訊（這些不需要搜尋，直接使用）：
- 銘柄：${brandName}
- 酒造：${brewery}
- 產地：${origin || '未知，請從搜尋結果補齊'}
- 酒精濃度（圖片）：${vision.alcoholPercent || '未知'}
- 精米步合（圖片）：${vision.seimaibuai || '未知'}
- 使用米（圖片）：${vision.riceName || '未知'}
- 特殊製程（圖片）：${JSON.stringify(vision.specialProcess || [])}

請用 Google Search 查詢並補齊空缺欄位。回傳規則：
1. brandName 和 brewery 必須使用圖片辨識結果（${brandName}、${brewery}），不可被搜尋結果覆蓋
2. 圖片已有的酒精濃度、精米步合等數值以圖片為準，搜尋結果僅補充圖片看不到的欄位
3. 所有文字保持日文原文，不要翻譯
4. specialProcess 只填入搜尋結果中「明確對應這款酒產品頁」的製法標籤，寧可空白也不填可疑資訊
5. brandName 不可補上圖片裡沒有出現的上位品牌、代表銘柄或系列母名；若圖片是「CHIMERA」，就不能自行變成「醸し人九平次 CHIMERA」這類串接名稱
6. brandName 必須保留完整品名，不要把疑似副名稱拆出去；subBrand 留空
7. 就算品名裡含有像酒米名的字樣，也不要因此把它從 brandName 移除；只有在圖片或搜尋結果明確同時標示使用米時，才另外填 riceName
8. 受賞資訊除非搜尋結果明確說明是這瓶，否則不填；酵母若無明確資料也不填`,
        },
      ],
    }).catch(() => ({ output: null }));

    // Step 2 失敗時降級回傳 Step 1 結果
    const step2SearchMs = Math.round((performance.now() - step2Start) * 10) / 10;
    if (!enriched) {
      const fallbackResult = {
        brandName,
        subBrand: '',
        brewery,
        origin,
        alcoholPercent: vision.alcoholPercent || '',
        seimaibuai: vision.seimaibuai || '',
        riceName: vision.riceName || '',
        specialProcess: vision.specialProcess || [],
        yeast: vision.yeast || '',
        smv: vision.smv || '',
      };
      logTiming('vision-step1-fallback', { cloudVisionMs, step1VisionMs, step2SearchMs, hasBackLabel, isSuspiciousBrand });
      return fallbackResult;
    }

    // 合併結果：銘柄/酒造以視覺辨識為主，規格細節以搜尋補充
    // specialProcess 取聯集；若視覺 brandName 疑為裝飾字，以搜尋結果覆蓋
    const finalResult = {
      ...enriched,
      brandName: (!isSuspiciousBrand && brandName) ? brandName : enriched.brandName,
      subBrand: '',
      brewery: brewery || enriched.brewery,
      origin: origin || enriched.origin,
      alcoholPercent: vision.alcoholPercent || enriched.alcoholPercent || '',
      seimaibuai: vision.seimaibuai || enriched.seimaibuai || '',
      riceName: vision.riceName || enriched.riceName || '',
      specialProcess: mergeUnique(vision.specialProcess || [], enriched.specialProcess || []),
      yeast: vision.yeast || enriched.yeast || '',
      smv: vision.smv || enriched.smv || '',
    };
    logTiming('full-search-path', { cloudVisionMs, step1VisionMs, step2SearchMs, hasBackLabel, isSuspiciousBrand });
    return finalResult;
  }
);
