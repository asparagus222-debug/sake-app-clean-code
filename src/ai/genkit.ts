import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Genkit 全域配置檔
 * 串接 Gemini 2.0 Flash 模型以提供極速且高精度的清酒酒標辨識能力。
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});
