import { afterEach, describe, expect, it, vi } from 'vitest';

async function importClient() {
  vi.resetModules();
  return import('@/lib/openai-client');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getOpenAiClient', () => {
  it('throws when OPENAI_API_KEY is not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { getOpenAiClient } = await importClient();
    expect(() => getOpenAiClient()).toThrow('OPENAI_API_KEY is required for AI image generation.');
  });

  it('returns the same client instance on repeated calls', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const { getOpenAiClient } = await importClient();
    const first = getOpenAiClient();
    const second = getOpenAiClient();
    expect(first).toBe(second);
  });
});
