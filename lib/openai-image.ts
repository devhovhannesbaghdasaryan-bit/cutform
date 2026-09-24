import 'server-only';

import type OpenAI from 'openai';
import { getServerEnv } from '@/lib/env';

export interface OpenAiImageInput {
  prompt: string;
  /** Skill document texts injected as input_text parts before the prompt, in given order. */
  skillTexts?: string[];
  userImages: File[];
  referenceFileId?: string | null;
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

export interface ImageResponseLike {
  status?: string | null;
  incomplete_details?: { reason?: string | null } | null;
  output: Array<{
    type: string;
    result?: string | null;
    status?: string | null;
    content?: Array<{ type: string; text?: string; refusal?: string }>;
  }>;
}

/**
 * Builds a diagnostic string describing why a Responses API result carried no
 * image: the response status, every output item type with its status, and any
 * assistant text or refusal the model returned instead of calling the tool.
 */
export function describeImageResponse(response: ImageResponseLike): string {
  const parts: string[] = [];
  if (response.status) parts.push(`status=${response.status}`);
  if (response.incomplete_details?.reason) {
    parts.push(`incomplete=${response.incomplete_details.reason}`);
  }
  parts.push(
    `output=[${response.output
      .map((item) => (item.status ? `${item.type}:${item.status}` : item.type))
      .join(', ')}]`,
  );
  for (const item of response.output) {
    for (const part of item.content ?? []) {
      if (part.type === 'refusal' && part.refusal) parts.push(`refusal="${part.refusal}"`);
      else if (part.type === 'output_text' && part.text) parts.push(`text="${part.text}"`);
    }
  }
  return parts.join(' ');
}

/**
 * Extracts the generated image from a Responses API result. The `image_generation`
 * tool call result is base64-encoded; this SDK version has no revised-prompt field
 * on the call, so `revisedPrompt` is always null. When no image is present the
 * error message carries the model's own explanation so it lands in server logs.
 */
export function extractGeneratedImage(response: ImageResponseLike): GeneratedImage {
  const call = response.output.find((item) => item.type === 'image_generation_call');
  if (!call?.result) {
    throw new Error(`OpenAI did not return a generated image. ${describeImageResponse(response)}`);
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
          ...(input.skillTexts ?? []).map((text) => ({ type: 'input_text' as const, text })),
          { type: 'input_text', text: input.prompt },
          ...userImageParts,
          ...(input.referenceFileId
            ? [
                {
                  type: 'input_image' as const,
                  detail: 'auto' as const,
                  file_id: input.referenceFileId,
                },
              ]
            : []),
        ],
      },
    ],
    tools: [{ type: 'image_generation', model: getImageModel(), size, quality }],
    // Force the tool call: without this the responses model may answer with
    // text (a question or a refusal) and return no image_generation_call.
    tool_choice: { type: 'image_generation' },
  });

  return extractGeneratedImage(response);
}
