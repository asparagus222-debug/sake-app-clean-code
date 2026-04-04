'use server';
/**
 * @fileOverview 清酒酒標兩段式辨識 AI Agent。
 * Step 1: 純視覺 OCR — 模型只專注讀取圖片上的日文文字，不進行外部搜尋。
 * Step 2: 精準 Google Search — 用 Step 1 提取到的正確日文名稱搜尋官方規格，補齊細節。
 */

import Anthropic from '@anthropic-ai/sdk';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';

const IdentifySakeInputSchema = z.object({
  photoDataUri: z.string().describe(
    "A photo of a sake label, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
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
});
export type IdentifySakeOutput = z.infer<typeof IdentifySakeOutputSchema>;

// Claude/Gemini 共用視覺提取 Schema
const VisionExtractionSchema = z.object({
  allText: z.array(z.string()).optional().describe('圖片上所有可見文字列表（用於備用搜尋）'),
  brandName: z.string(),
  brewery: z.string(),
  origin: z.string(),
  alcoholPercent: z.string(),
  seimaibuai: z.string(),
  riceName: z.string(),
  specialProcess: z.array(z.string()),
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
    // ── Step 1: Claude 純視覺 OCR ──
    // 使用 @anthropic-ai/sdk 官方 SDK 直接呼叫，不受 genkit plugin model 清單限制
    // 使用 claude-sonnet-4-6（最新版）
    let vision: z.infer<typeof VisionExtractionSchema> | null = null;

    try {
      const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const matches = input.photoDataUri.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) throw new Error('Invalid photoDataUri format');
      const mediaType = matches[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      const base64Data = matches[2];

      const response = await anthropicClient.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        // 超過 12s 視為超時，直接 fallback 到 Gemini，避免整體超過 20s
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: `你是日文清酒酒標的完整文字辨識專家。

【第一步】請列出這張圖片上「所有」你能看到的文字字串，無論大小、無論印刷或書法。
【第二步】從列表中判斷銘柄、酒造等欄位。

⚠️ 重要注意：
- 酒標上常有「大型藝術書道」的單個漢字（如毛筆大字的裝飾），這是視覺元素，不是銘柄
- 真正的銘柄通常是裝飾字旁邊「較小的清晰印刷」文字，特別是平假名（如まるわらい）
- 例：大型書道字「笑」旁邊可能有小字「まるわらい」——後者才是銘柄
- 只報告圖片中「實際可見」的文字，絕對不要猜測或編造
- 所有輸出必須是日文原文，不要翻譯

請回傳 JSON（不加 markdown code block）：
{"allText":["圖片上所有可見文字"],"brandName":"銘柄","brewery":"酒造（圖片看不到填不明）","origin":"産地","alcoholPercent":"酒精濃度","seimaibuai":"精米步合","riceName":"使用米","specialProcess":["種別/製法"],"searchQuery":"最佳日文搜尋詞"}` },
          ],
        }],
      }, { timeout: 12000 }); // 12s timeout — fallback 到 Gemini 避免整體超過 20s

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        vision = JSON.parse(jsonMatch[0]);
        console.log('[AI辨識] Step 1 使用: Claude claude-sonnet-4-6');
      }
    } catch (err) {
      console.error('[AI辨識] Claude Step 1 failed, falling back to Gemini:', err);
    }

    // Claude 失敗/超時時降級到 Gemini 單步辨識（圖片直接輸入，省去 F1+F2 兩步）
    if (!vision) {
      console.log('[AI辨識] Step 1 使用: Gemini fallback');
      const { output: geminiVision } = await ai.generate({
        model: googleAI.model('gemini-flash-latest'),
        output: { schema: VisionExtractionSchema },
        prompt: [
          {
            text: `你是日文清酒酒標的完整文字辨識專家。

【第一步】請列出這張圖片上「所有」你能看到的文字字串，無論大小、無論印刷或書法。
【第二步】從列表中判斷銘柄、酒造等欄位。

⚠️ 重要：酒標上大型書道裝飾字（如笑、夢）是美術設計，不是銘柄；真正銘柄通常是裝飾字旁邊較小的清晰印刷文字，特別是平假名。

請回傳 JSON（不加 markdown）：
{"allText":["所有可見文字"],"brandName":"銘柄","brewery":"酒造","origin":"産地","alcoholPercent":"酒精濃度","seimaibuai":"精米步合","riceName":"使用米","specialProcess":["..."],"searchQuery":"日文搜尋詞"}`,
          },
          { media: { url: input.photoDataUri, contentType: 'image/jpeg' } },
        ],
      }).catch(() => ({ output: null }));

      vision = geminiVision ?? { allText: [], brandName: '', brewery: '', origin: '', alcoholPercent: '', seimaibuai: '', riceName: '', specialProcess: [], searchQuery: '' };
    }

    if (!vision) throw new Error('無法從圖片提取資訊，請確保酒標清晰可見。');

    const { brandName, brewery, origin } = vision;
    // 取出括號/空格前的「核心銘柄字串」做可疑判斷
    // 例：「子 (純米大吟醸)」→ core = "子"（單字，可疑）；「まるわらい」→ core = "まるわらい"（正常）
    const brandNameCore = brandName.split(/[\s（(]/)[0].trim();
    const isSuspiciousBrand = !brandName || brandNameCore.length <= 1;
    const allTextJoined = (vision.allText || []).join(' ');
    const searchQuery = isSuspiciousBrand && allTextJoined
      ? `${allTextJoined} 日本酒`
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
          text: `你是清酒資料庫專家。請用 Google Search 搜尋「${query}」，找出這款日本酒的完整規格。

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
3. 所有文字保持日文原文，不要翻譯`,
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
      };
    }

    // 合併結果：銘柄/酒造以視覺辨識為主，規格細節以搜尋為主（補充圖片看不到的）
    // 例外：若視覺 brandName 疑為裝飾字（≤2字），以 Step 2 搜尋結果覆蓋
    return {
      ...enriched,
      brandName: (!isSuspiciousBrand && brandName) ? brandName : enriched.brandName,
      brewery: brewery || enriched.brewery,
      origin: origin || enriched.origin,
      alcoholPercent: vision.alcoholPercent || enriched.alcoholPercent || '',
      seimaibuai: vision.seimaibuai || enriched.seimaibuai || '',
      riceName: vision.riceName || enriched.riceName || '',
      specialProcess: (vision.specialProcess?.length ? vision.specialProcess : enriched.specialProcess) || [],
    };
  }
);
