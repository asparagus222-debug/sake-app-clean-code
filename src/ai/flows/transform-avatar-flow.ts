'use server';
/**
 * @fileOverview A flow to transform user avatars or any image into different artistic styles using AI.
 * Updated to use Gemini 2.0 Flash for maximum creative quality.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TransformAvatarInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "The source photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  style: z.enum(['ghibli', 'cyberpunk', 'watercolor', 'ukiyo-e']).describe('The target artistic style.'),
});
export type TransformAvatarInput = z.infer<typeof TransformAvatarInputSchema>;

const TransformAvatarOutputSchema = z.object({
  transformedPhotoDataUri: z.string().describe('The generated image as a data URI.'),
});
export type TransformAvatarOutput = z.infer<typeof TransformAvatarOutputSchema>;

export async function transformAvatar(input: TransformAvatarInput): Promise<TransformAvatarOutput> {
  return transformAvatarFlow(input);
}

const stylePrompts: Record<string, string> = {
  'ghibli': 'Transform this image into a Studio Ghibli anime style. Use soft, hand-drawn textures, magical lighting, and a vibrant yet gentle color palette. Make the subject look like a character or object from a Ghibli movie.',
  'cyberpunk': 'Transform this image into a cyberpunk aesthetic. Use high-contrast neon lighting (cyan and magenta), futuristic details, and a high-tech atmosphere.',
  'watercolor': 'Transform this image into a delicate watercolor painting. Use soft brush strokes, visible paper texture, and elegant, blended colors.',
  'ukiyo-e': 'Transform this image into a classic Japanese Ukiyo-e woodblock print. Use bold outlines, flat areas of color, and traditional Edo period artistic conventions.',
};

const transformAvatarFlow = ai.defineFlow(
  {
    name: 'transformAvatarFlow',
    inputSchema: TransformAvatarInputSchema,
    outputSchema: TransformAvatarOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      // Uses default model (Gemini 2.0 Flash) configured in src/ai/genkit.ts
      prompt: [
        { media: { url: input.photoDataUri } },
        { text: `${stylePrompts[input.style] || stylePrompts['ghibli']} Keep the original composition and essential features of the subject clearly recognizable.` },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        ],
      },
    });

    if (!media) {
      throw new Error('AI failed to generate the transformed image.');
    }

    return {
      transformedPhotoDataUri: media.url,
    };
  }
);
