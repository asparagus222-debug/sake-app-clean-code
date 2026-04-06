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
  brandName: z.string().describe('銘柄名稱 (例如：十四代、新政、而今) 請保持日文原文。'),
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

// Gemini 視覺提取 Schema
const VisionExtractionSchema = z.object({
  allText: z.array(z.string()).optional().describe('圖片上所有可見文字列表（用於備用搜尋）'),
  visualDescription: z.string().optional().describe('酒標構圖特徵：瓶身/標籤顏色、主要圖案（如山水、花、動物、幾何）、有無印章或特殊標記、筆觸風格（細緻/粗獷）'),
  brandName: z.string(),
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

export const identifySakeFlow = ai.defineFlow(
  {
    name: 'identifySakeFlow',
    inputSchema: IdentifySakeInputSchema,
    outputSchema: IdentifySakeOutputSchema,
  },
  async (input) => {
    const hasBackLabel = !!input.backPhotoDataUri;

    // 合併標籤陣列，去重（圖片標籤在前）
    const mergeUnique = (img: string[], search: string[]) => [...new Set([...img, ...search])];

    // ── 快速路徑：有背標時，先純視覺 OCR，再補充搜尋，圖片數值絕對優先 ──
    if (hasBackLabel) {
      // Step A：純視覺 OCR，100% 從圖片讀取所有欄位
      console.log('[AI辨識] 快速路徑 Step A：背標純視覺 OCR');
      const { output: backOcr } = await ai.generate({
        model: googleAI.model('gemini-flash-latest'),
        output: { schema: IdentifySakeOutputSchema },
        prompt: [
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

      if (backOcr?.brandName && backOcr?.brewery) {
        console.log('[AI辨識] 快速路徑 Step A 成功:', backOcr.brandName, '→ Step B 補充搜尋');

        // Step B：搜尋這款酒的補充製法資訊，嚴格要求有搜尋結果依據才能填入
        const supplementQuery = `"${backOcr.brandName}" "${backOcr.brewery}" 日本酒`;
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
        return {
          brandName: backOcr.brandName,
          brewery: backOcr.brewery,
          origin: backOcr.origin || supplement?.origin || '',
          alcoholPercent: backOcr.alcoholPercent || '',
          seimaibuai: backOcr.seimaibuai || '',
          riceName: backOcr.riceName || '',
          specialProcess: mergeUnique(backOcr.specialProcess || [], supplement?.specialProcess || []),
          yeast: backOcr.yeast || supplement?.yeast || '',
          smv: backOcr.smv || supplement?.smv || '',
        };
      }
      console.log('[AI辨識] 快速路徑 OCR 未取得完整品牌資訊，回退至完整流程');
    }

    // ── Step 1: Gemini 純視覺 OCR ──
    // 若有背標，優先以背標作為主要辨識圖片（背標通常有清晰印刷文字）
    const primaryImage = hasBackLabel ? input.backPhotoDataUri! : input.photoDataUri;
    const secondaryImage = hasBackLabel ? input.photoDataUri : null;

    const { output: geminiVision } = await ai.generate({
      model: googleAI.model('gemini-flash-latest'),
      output: { schema: VisionExtractionSchema },
      prompt: [
        {
          text: `你是日文清酒酒標的完整文字辨識專家。${hasBackLabel ? '我提供了背標（第一張）和正標（第二張）兩張圖片，背標有完整且清晰的印刷文字，請優先從背標讀取所有資訊（銘柄、酒造、規格等）。' : ''}

【第一步】列出圖片上「所有」可見文字。
【第二步】描述酒標視覺構圖：主色調、大型書道文字（直接寫出是哪個字，如「笑」「夢」「粋」）、有無印章、筆觸風格。
【第三步】從文字和視覺共同判斷銘柄，並產生包含「書道大字本身」+「其他關鍵詞」的 searchQuery（例如：「笑 伝承乃技 純米大吟醸 日本酒」）。

⚠️ 重要：大型書道裝飾字不是銘柄；searchQuery 要包含正確讀出的書道大字。${hasBackLabel ? '\n- 第一張圖（背標）有完整印刷銘柄文字，請從背標讀取作為主要資訊來源' : ''}

請回傳 JSON（不加 markdown）：
{"allText":["所有可見文字"],"visualDescription":"視覺特徵含書道大字名稱","brandName":"銘柄","brewery":"酒造","origin":"産地","alcoholPercent":"酒精濃度","seimaibuai":"精米步合","riceName":"使用米","specialProcess":["..."],"yeast":"使用酵母","searchQuery":"書道大字+其他搜尋詞"}`,
        },
        { media: { url: primaryImage, contentType: 'image/jpeg' } },
        ...(secondaryImage ? [{ media: { url: secondaryImage, contentType: 'image/jpeg' } }] : []),
      ],
    }).catch(() => ({ output: null }));

    const vision = geminiVision ?? { allText: [], brandName: '', brewery: '', origin: '', alcoholPercent: '', seimaibuai: '', riceName: '', specialProcess: [], searchQuery: '' };

    const { brandName, brewery, origin } = vision;
    // 取出括號/空格前的「核心銘柄字串」做可疑判斷
    // 例：「子 (純米大吟醸)」→ core = "子"（單字，可疑）；「まるわらい」→ core = "まるわらい"（正常）
    // 常見裝飾漢字（書道大字）一律視為可疑，不論長短
    const DECORATIVE_KANJI = new Set(['笑', '夢', '粋', '縁', '楽', '誠', '心', '愛', '龍', '鶴', '宇', '字', '子', '幸', '福']);
    const brandNameCore = brandName.split(/[\s（(]/)[0].trim();
    const isSuspiciousBrand = !brandName
      || brandNameCore.length <= 1
      || DECORATIVE_KANJI.has(brandNameCore);
    const allTextJoined = (vision.allText || []).join(' ');
    // isSuspiciousBrand 時：vision.searchQuery（含 Step 1 推斷的視覺關鍵詞）+ visualDescription（含書道大字名稱如「笑」）
    // 這樣能確保「笑 伝承乃技 純米大吟醸」進入 Google Search，找到 まるわらい 等用書道字命名的酒
    const searchQuery = isSuspiciousBrand
      ? [`${vision.searchQuery || ''}`, `${vision.visualDescription || ''}`, '日本酒'].filter(Boolean).join(' ').trim()
      : (vision.searchQuery || `${brandName} ${brewery} 日本酒`);

    if (isSuspiciousBrand) {
      console.log(`[AI辨識] brandName "${brandName}" 疑為裝飾字，改用 allText 搜尋: ${searchQuery}`);
    }

    // 若品牌和酒造都無法辨識，直接回傳視覺結果（避免搜出無關結果）
    if (!brandName && !brewery && !isSuspiciousBrand) {
      return {
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
    }

    // ── Step 2: Google Search 補齊規格 ──
    // 用 Step 1 精確提取的日文名稱去搜尋，準確度遠高於直接用圖片搜尋。
    const query = searchQuery;

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
4. 若搜尋結果有酵母資訊（yeast欄位）請一並填入`
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
5. 受賞資訊除非搜尋結果明確說明是這瓶，否則不填；酵母若無明確資料也不填`,
        },
      ],
    }).catch(() => ({ output: null }));

    // Step 2 失敗時降級回傳 Step 1 結果
    if (!enriched) {
      return {
        brandName,
        brewery,
        origin,
        alcoholPercent: vision.alcoholPercent || '',
        seimaibuai: vision.seimaibuai || '',
        riceName: vision.riceName || '',
        specialProcess: vision.specialProcess || [],
        yeast: vision.yeast || '',
        smv: vision.smv || '',
      };
    }

    // ── Step 2.5: 酒造名縮小搜尋（若 Step 2 返回的 brandName 是酒造名前綴）──
    // 例：brandName "名城" 是 brewery "名城酒造" 的組成部分 → 再以酒造名+製法精確搜尋真正的銘柄
    let finalEnriched = enriched;
    if (isSuspiciousBrand && enriched.brandName && enriched.brewery) {
      const isBrandLikeBrewery = enriched.brewery.includes(enriched.brandName) && enriched.brandName.length >= 2;
      if (isBrandLikeBrewery) {
        console.log(`[AI辨識] brandName "${enriched.brandName}" 疑似酒造名前綴，以酒造名再搜尋`);
        const refinedQuery = `${enriched.brewery} ${(vision.specialProcess || []).join(' ')} 銘柄`;
        const { output: refined } = await ai.generate({
          model: googleAI.model('gemini-flash-latest'),
          config: { googleSearchRetrieval: true },
          output: { schema: IdentifySakeOutputSchema },
          prompt: [{
            text: `你是清酒資料庫專家。已確認此酒的酒造是「${enriched.brewery}」，特殊製法是「${JSON.stringify(vision.specialProcess || [])}」。

請用 Google Search 搜尋「${refinedQuery}」，找出這家酒造出產的具體銘柄（品牌名）。

⚠️ 重要：
- 銘柄是品牌名（例如：まるわらい、而今、新政）
- 不可將酒造名作為銘柄回傳（例如：「名城」「名城酒造」不是銘柄）
- 所有文字保持日文原文，不要翻譯`,
          }],
        }).catch(() => ({ output: null }));
        // 確認 refined 的 brandName 不是酒造名本身才採用
        if (refined?.brandName && !enriched.brewery.includes(refined.brandName)) {
          finalEnriched = { ...enriched, ...refined, brewery: refined.brewery || enriched.brewery };
        }
      }
    }

    // 合併結果：銘柄/酒造以視覺辨識為主，規格細節以搜尋為主（補充圖片看不到的）
    // specialProcess 取聯集：圖片讀到的 + 搜尋補充的，兩者皆保留
    // 例外：若視覺 brandName 疑為裝飾字（≤2字），以 Step 2/2.5 搜尋結果覆蓋
    return {
      ...finalEnriched,
      brandName: (!isSuspiciousBrand && brandName) ? brandName : finalEnriched.brandName,
      brewery: brewery || finalEnriched.brewery,
      origin: origin || finalEnriched.origin,
      alcoholPercent: vision.alcoholPercent || finalEnriched.alcoholPercent || '',
      seimaibuai: vision.seimaibuai || finalEnriched.seimaibuai || '',
      riceName: vision.riceName || finalEnriched.riceName || '',
      specialProcess: mergeUnique(vision.specialProcess || [], finalEnriched.specialProcess || []),
      yeast: vision.yeast || finalEnriched.yeast || '',
      smv: vision.smv || finalEnriched.smv || '',
    };
  }
);
