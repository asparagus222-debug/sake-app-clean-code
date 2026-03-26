'use server';
/**
 * @fileOverview 清酒酒標視覺搜尋 AI Agent。
 * 專注於從圖片中提取酒標資訊，並嚴格保持日文原文輸出。
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai'; 
import { z } from 'genkit';

const IdentifySakeInputSchema = z.object({
  photoDataUri: z.string()

    .describe(
      "A photo of a sake label, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type IdentifySakeInput = z.infer<typeof IdentifySakeInputSchema>;

const IdentifySakeOutputSchema = z.object({
  brandName: z.string().describe('銘柄名稱 (例如：十四代、新政、而今) 請保持日文原文。'),
  brewery: z.string().describe('酒造名稱 (例如：高木酒造) 請保持日文原文。'),
  origin: z.string().describe('產地縣市 (例如：山形県) 請保持日文原文。'),
});
export type IdentifySakeOutput = z.infer<typeof IdentifySakeOutputSchema>;

export async function identifySake(input: IdentifySakeInput): Promise<IdentifySakeOutput> {
  return identifySakeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'identifySakePrompt',
  input: {schema: IdentifySakeInputSchema},
  output: {schema: IdentifySakeOutputSchema},
  prompt: `你是一位世界級的清酒專家。請從圖片中提取酒標資訊。

你的任務是分析這張清酒酒標影像，並識別出銘柄名稱、酒造名稱以及產地。

限制：
1. 請直接以「日文原文」回傳資訊。
2. 品牌名、酒造名與產地縣市必須與酒標上的文字完全一致。
3. 不要進行繁體中文翻譯，保持日文漢字或假名。

請輸出：
- brandName: 銘柄名稱
- brewery: 酒造名稱
- origin: 產地縣市

照片：{{media url=photoDataUri}}`,
});

// ... 前面代碼保持不變
// ... 前面 Schema 定義不變

export const identifySakeFlow = ai.defineFlow(
  {
    name: 'identifySakeFlow',
    inputSchema: IdentifySakeInputSchema,
    outputSchema: IdentifySakeOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      model: googleAI.model('gemini-flash-latest'),
      // 關鍵修正 1：明確指定輸出 Schema
      output: {
        schema: IdentifySakeOutputSchema,
      },
      // 關鍵修正 2：在 prompt 裡強調 JSON 格式
      prompt: [
        { text: '你是一位世界級的清酒專家。請精確識別這張照片中的清酒資訊，並以 JSON 格式回傳銘柄、酒造與產地。請務必保持日文原文。' },
        { media: { url: input.photoDataUri, contentType: 'image/jpeg' } },
      ],
    });

    if (!output) {
      throw new Error('AI 回傳資料為空，請確保酒標清晰可見。');
    }

    return output;
  }
);