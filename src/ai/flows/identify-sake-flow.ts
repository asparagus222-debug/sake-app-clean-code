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

// Gemini 降級用 — F1: 純粗掃 OCR，只畫出圖片上所有可見文字，不做銘柄判斷
const RawLabelTextSchema = z.object({
  allVisibleText: z.array(z.string()).describe('圖片上所有可讀到的日文文字，每一個文字片段為一項，不用判斷哪個是銘柄，全部列出。保持日文原文。'),
  bottleDescription: z.string().describe('瓶子外觀摒述（顏色、形狀、酒標風格），用於輔助搜尋。'),
  searchQuery: z.string().describe('根據圖片上的可見文字，組合成最合適 Google 搜尋清酒資料的日文關鍵字。'),
});

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
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        vision = JSON.parse(jsonMatch[0]);
        console.log('[AI辨識] Step 1 使用: Claude claude-sonnet-4-6');
      }
    } catch (err) {
      console.error('[AI辨識] Claude Step 1 failed, falling back to Gemini:', err);
    }

    // Claude 失敗時降級到 Gemini 两段式辨識
    // Gemini F1: 純粗掃 OCR — 列出圖片上所有文字，不做銘柄判斷，避免把標語當銘柄
    if (!vision) {
      console.log('[AI辨識] Step 1 使用: Gemini fallback (兩段式)');
      const { output: rawText } = await ai.generate({
        model: googleAI.model('gemini-flash-latest'),
        output: { schema: RawLabelTextSchema },
        prompt: [
          {
            text: `你是图点文字提取工具。請仔細掃描這張酒標圖片，列出所有能讀到的日文文字片段。

重要：
- allVisibleText 要包含圖片上「全部」可見文字，不用判斷哪個是銘柄、哪個是標語，將所有文字都列出
- bottleDescription 描述瓶子外觀（顏色、酒標風格等）
- searchQuery 用圖片中可見的文字組合成挀尋日本酒的搜尋關鍵字

保持日文原文，不要翻譯。`,
          },
          { media: { url: input.photoDataUri, contentType: 'image/jpeg' } },
        ],
      });

      // Gemini F2: Google Search 以 F1 的文字收尋，由搜尋結果確認銘柄
      if (rawText) {
        const allText = rawText.allVisibleText.join(' ');
        const searchQ = rawText.searchQuery || `${allText} 日本酒 酒造`;

        const { output: searchResult } = await ai.generate({
          model: googleAI.model('gemini-flash-latest'),
          config: { googleSearchRetrieval: true },
          output: { schema: VisionExtractionSchema },
          prompt: [{
            text: `你是清酒專家。以下是從一張清酒酒標圖片上讀到的全部可見文字：
[ ${allText} ]
瓶子外觀：${rawText.bottleDescription}

請用 Google Search 搜尋「${searchQ}」，找出這是哪一款日本酒。

門諊：上列文字中，有些可能是酒造的廣告標語、酒類名稱、戏語技術，而非銘柄。請以搜尋結果為依據，確認這款酒的正確銘柄名稱。

回傳檔位：brandName(銘柄)、brewery(酒造)、origin(產地)、alcoholPercent(酒精濃度)、seimaibuai(精米步合)、riceName(使用米)、specialProcess(特殊製程陣列)、searchQuery(部署搜尋用)。全部日文原文。`,
          }],
        }).catch(() => ({ output: null }));

        vision = searchResult ?? { brandName: '', brewery: '', origin: '', alcoholPercent: '', seimaibuai: '', riceName: '', specialProcess: [], searchQuery: rawText.searchQuery };
      } else {
        vision = { brandName: '', brewery: '', origin: '', alcoholPercent: '', seimaibuai: '', riceName: '', specialProcess: [], searchQuery: '' };
      }
    }

    if (!vision) throw new Error('無法從圖片提取資訊，請確保酒標清晰可見。');

    const { brandName, brewery, origin } = vision;
    // 如果 brandName ≤2 字（可能是誤讀裝飾書法字），改以 allText 全部可見文字搜尋
    const isSuspiciousBrand = !brandName || brandName.replace(/[（(）)]/g, '').length <= 2;
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
