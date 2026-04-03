'use server';
/**
 * @fileOverview 清酒酒標兩段式辨識 AI Agent。
 * Step 1: 純視覺 OCR — 模型只專注讀取圖片上的日文文字，不進行外部搜尋。
 * Step 2: 精準 Google Search — 用 Step 1 提取到的正確日文名稱搜尋官方規格，補齊細節。
 */

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

// Step 1 中間結果 Schema（只包含從圖片直接提取到的資訊）
const VisionExtractionSchema = z.object({
  brandName: z.string().describe('酒標上最醒目的銘柄名，日文原文。找不到填空字串。'),
  brewery: z.string().describe('製造商/酒造名稱，日文原文。找不到填空字串。'),
  origin: z.string().describe('產地縣市，日文原文。圖片看不到則空字串。'),
  alcoholPercent: z.string().describe('酒精濃度，圖片看不到則空字串。'),
  seimaibuai: z.string().describe('精米步合，圖片看不到則空字串。'),
  riceName: z.string().describe('使用米品種，圖片看不到則空字串。'),
  specialProcess: z.array(z.string()).describe('酒標上可見的特殊製程（如純米大吟醸），無則空陣列。'),
  searchQuery: z.string().describe('用於後續 Google 搜尋的日文關鍵字，格式：「銘柄名 酒造名 日本酒」'),
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
    // ── Step 1: 純視覺 OCR ──
    // 模型只專注讀取圖片，完全不進行外部搜尋。
    // 銘柄、酒造名稱的識別準確度等同 OCR（不受其他雜訊干擾）。
    const { output: vision } = await ai.generate({
      model: googleAI.model('gemini-flash-latest'),
      output: { schema: VisionExtractionSchema },
      prompt: [
        {
          text: `你是日文清酒酒標的 OCR 專家。請仔細觀察這張酒標圖片，精確提取所有可見的文字資訊。

規則：
1. 只報告圖片中「實際可見」的文字，絕對不要猜測或編造
2. 所有輸出必須是日文原文（漢字/假名），不要翻譯
3. brandName = 酒標上最大、最醒目的品牌名稱（通常是平假名或漢字，例如まるわらい）
4. brewery = 製造商名稱，通常在瓶底或背標（例如名城酒造株式会社）
5. 背標上通常有最完整的規格（アルコール分、精米歩合、原料米等），請仔細讀取
6. specialProcess 包含酒類種別（如純米大吟醸）和特殊製法（如生原酒、無濾過）
7. searchQuery 填入最適合 Google 搜尋這款酒的日文關鍵字

請仔細掃描圖片中所有文字後輸出結果。`,
        },
        { media: { url: input.photoDataUri, contentType: 'image/jpeg' } },
      ],
    });

    if (!vision) {
      throw new Error('無法從圖片提取資訊，請確保酒標清晰可見。');
    }

    const { brandName, brewery, origin, searchQuery } = vision;

    // 若品牌和酒造都無法辨識，直接回傳視覺結果（避免搜出無關結果）
    if (!brandName && !brewery) {
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
    const query = searchQuery || `${brandName} ${brewery} 日本酒`;

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
    return {
      ...enriched,
      brandName: brandName || enriched.brandName,
      brewery: brewery || enriched.brewery,
      origin: origin || enriched.origin,
      alcoholPercent: vision.alcoholPercent || enriched.alcoholPercent || '',
      seimaibuai: vision.seimaibuai || enriched.seimaibuai || '',
      riceName: vision.riceName || enriched.riceName || '',
      specialProcess: (vision.specialProcess?.length ? vision.specialProcess : enriched.specialProcess) || [],
    };
  }
);
