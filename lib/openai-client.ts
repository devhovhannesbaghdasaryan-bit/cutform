import 'server-only';

import OpenAI from 'openai';
import { getServerEnv } from '@/lib/env';

let client: OpenAI | null = null;

/** Lazily constructs a singleton OpenAI client, throwing if no API key is configured. */
export function getOpenAiClient(): OpenAI {
  const apiKey = getServerEnv().OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for AI image generation.');
  client ??= new OpenAI({ apiKey });
  return client;
}
