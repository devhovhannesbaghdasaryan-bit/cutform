import 'server-only';

import { generateImage } from 'ai';
import {
  openai,
  type OpenAIImageModelEditOptions,
  type OpenAIImageModelGenerationOptions,
} from '@ai-sdk/openai';
import { getServerEnv } from '@/lib/env';

export interface OpenAiImageInput {
  prompt: string;
  images?: File[];
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
}

function getImageModel() {
  return getServerEnv().OPENAI_IMAGE_MODEL ?? 'gpt-image-2';
}

function assertApiKey() {
  if (!getServerEnv().OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for AI image generation.');
  }
}

export async function generateOpenAiImage(input: OpenAiImageInput) {
  assertApiKey();
  const quality = input.quality ?? 'low';
  const size = input.size ?? '1024x1024';
  const referenceImages = await Promise.all(
    (input.images ?? []).map(async (image) => new Uint8Array(await image.arrayBuffer())),
  );

  const { image, providerMetadata } = await generateImage({
    model: openai.image(getImageModel()),
    prompt: referenceImages.length ? { text: input.prompt, images: referenceImages } : input.prompt,
    size: size === 'auto' ? undefined : size,
    providerOptions: {
      openai: referenceImages.length
        ? ({ quality } satisfies OpenAIImageModelEditOptions)
        : ({ quality } satisfies OpenAIImageModelGenerationOptions),
    },
  });

  const [firstImageMetadata] = (providerMetadata.openai?.images ?? []) as Array<
    { revisedPrompt?: string } | undefined
  >;

  return {
    bytes: image.uint8Array,
    revisedPrompt: firstImageMetadata?.revisedPrompt ?? null,
  };
}
