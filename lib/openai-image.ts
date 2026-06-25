import 'server-only';

import { getServerEnv } from '@/lib/env';

type OpenAiImagePurpose = 'generation' | 'edit';

export interface OpenAiImageInput {
  prompt: string;
  images?: File[];
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  purpose?: OpenAiImagePurpose;
}

interface OpenAiImageResponse {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
}

function getImageModel() {
  return getServerEnv().OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
}

function getApiKey() {
  const apiKey = getServerEnv().OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for AI image generation.');
  return apiKey;
}

async function parseImageResponse(response: Response) {
  const json = await response.json().catch(() => null) as OpenAiImageResponse | null;
  if (!response.ok) {
    throw new Error(json?.error?.message ?? `OpenAI image request failed with ${response.status}.`);
  }

  const first = json?.data?.[0];
  if (!first?.b64_json) throw new Error('OpenAI image response did not include image data.');
  return {
    bytes: Uint8Array.from(Buffer.from(first.b64_json, 'base64')),
    revisedPrompt: first.revised_prompt ?? null,
  };
}

export async function generateOpenAiImage(input: OpenAiImageInput) {
  const hasImages = Boolean(input.images?.length);
  const endpoint = hasImages ? 'https://api.openai.com/v1/images/edits' : 'https://api.openai.com/v1/images/generations';
  const formData = new FormData();
  formData.set('model', getImageModel());
  formData.set('prompt', input.prompt);
  formData.set('size', input.size ?? '1024x1024');
  if (hasImages) {
    input.images?.forEach((image) => {
      formData.append('image[]', image, image.name || 'reference.png');
    });
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: formData,
  });

  return parseImageResponse(response);
}
