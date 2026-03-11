'use server';
/**
 * @fileOverview This file implements a Genkit flow to generate left/right brain
 * style tasting summaries based on user keywords and ratings.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSakeTastingSummaryInputSchema = z.object({
  keywords: z.string().describe('User keywords or short description.'),
  mode: z.enum(['left', 'right']).describe('Tasting mode: left (rational) or right (emotional).'),
  sweetnessRating: z.number().min(1).max(5),
  acidityRating: z.number().min(1).max(5),
  bitternessRating: z.number().min(1).max(5),
  umamiRating: z.number().min(1).max(5),
  astringencyRating: z.number().min(1).max(5),
  overallRating: z.number().min(1).max(10),
});
export type GenerateSakeTastingSummaryInput = z.infer<typeof GenerateSakeTastingSummaryInputSchema>;

const GenerateSakeTastingSummaryOutputSchema = z.object({
  summary: z.string().describe('The generated tasting summary.'),
});
export type GenerateSakeTastingSummaryOutput = z.infer<typeof GenerateSakeTastingSummaryOutputSchema>;

export async function generateSakeTastingSummary(input: GenerateSakeTastingSummaryInput): Promise<GenerateSakeTastingSummaryOutput> {
  return generateSakeTastingSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSakeSummaryPrompt',
  input: {schema: GenerateSakeTastingSummaryInputSchema},
  output: {schema: GenerateSakeTastingSummaryOutputSchema},
  prompt: `你是一位擁有專業證照、對清酒充滿熱情的頂級唎酒師（Sake Sommelier）。
請根據使用者的關鍵字與感官評分，撰寫一段極具專業感的品飲總結。

根據模式的不同，請採取對應的敘事風格：

當 mode 為 'left' 時（左腦模式 - 理性分析）：
- 風格：專業、邏輯、精確、結構化。
- 內容：分析香氣類型（如吟釀香、熟成香）、酸度的結構強度、酒體的平衡性、餘韻的長度與變化。
- 語氣：冷靜且專業的感官鑑定。

當 mode 為 'right' 時（右腦模式 - 感性直覺）：
- 風格：詩意、意象化、故事性、情感連結。
- 內容：描述這款酒帶來的場景想像（如清晨森林、夕陽海岸）、音樂感、色彩聯想、或與情緒的共鳴。
- 語氣：溫暖、豐富且具備藝術渲染力。

限制：
1. 必須使用繁體中文。
2. 長度控制在 100 字以內。
3. 嚴禁條列式，請寫成流暢的一段話。

輸入資訊：
- 模式：{{mode}}
- 關鍵字：{{{keywords}}}
- 甘酸苦旨澀評分：{{{sweetnessRating}}}, {{{acidityRating}}}, {{{bitternessRating}}}, {{{umamiRating}}}, {{{astringencyRating}}} (1-5級，3級為中口)
- 綜合評分：{{{overallRating}}}/10

請產出總結：`,
});

const generateSakeTastingSummaryFlow = ai.defineFlow(
  {
    name: 'generateSakeTastingSummaryFlow',
    inputSchema: GenerateSakeTastingSummaryInputSchema,
    outputSchema: GenerateSakeTastingSummaryOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
