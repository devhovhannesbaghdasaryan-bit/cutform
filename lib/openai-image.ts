import 'server-only';

import type OpenAI from 'openai';
import { getServerEnv } from '@/lib/env';

export interface OpenAiImageInput {
  prompt: string;
  userImages: File[];
  referenceFileId: string;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
}

export interface GeneratedImage {
  bytes: Uint8Array;
  revisedPrompt: string | null;
}

function getImageModel() {
  return getServerEnv().OPENAI_IMAGE_MODEL ?? 'gpt-image-2';
}

function getResponsesModel() {
  return getServerEnv().OPENAI_RESPONSES_MODEL ?? 'gpt-5-mini';
}

async function toInputImagePart(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = Buffer.from(bytes).toString('base64');
  return {
    type: 'input_image' as const,
    detail: 'auto' as const,
    image_url: `data:${file.type || 'image/jpeg'};base64,${base64}`,
  };
}

/**
 * Extracts the generated image from a Responses API result. The `image_generation`
 * tool call result is base64-encoded; this SDK version has no revised-prompt field
 * on the call, so `revisedPrompt` is always null.
 */
export function extractGeneratedImage(response: {
  output: Array<{ type: string; result?: string | null }>;
}): GeneratedImage {
  const call = response.output.find((item) => item.type === 'image_generation_call');
  if (!call || !call.result) {
    throw new Error('OpenAI did not return a generated image.');
  }
  return { bytes: new Uint8Array(Buffer.from(call.result, 'base64')), revisedPrompt: null };
}

export async function generateOpenAiImage(
  client: OpenAI,
  input: OpenAiImageInput,
): Promise<GeneratedImage> {
  const quality = input.quality ?? 'low';
  const size = input.size ?? '1024x1024';
  const userImageParts = await Promise.all(input.userImages.map(toInputImagePart));

  const response = await client.responses.create({
    model: getResponsesModel(),
    store: false,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: input.prompt },
          ...userImageParts,
          { type: 'input_image', detail: 'auto', file_id: input.referenceFileId },
        ],
      },
    ],
    tools: [{ type: 'image_generation', model: getImageModel(), size, quality }],
  });

  return extractGeneratedImage(response);
}
