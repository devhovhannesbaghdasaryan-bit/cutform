import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({
  requireAdminPermission: vi.fn(),
}));

vi.mock('@/lib/openai-client', () => ({
  getOpenAiClient: vi.fn(() => ({})),
}));

vi.mock('@/lib/item-ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/item-ai')>('@/lib/item-ai');
  return { ...actual, generateItemFields: vi.fn() };
});

import { requireAdminPermission } from '@/lib/admin';
import { generateItemFields } from '@/lib/item-ai';
import { generateItemFieldValuesAction } from '@/app/admin/items/ai-fill-actions';

describe('generateItemFieldValuesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unknown field key without checking permissions', async () => {
    const result = await generateItemFieldValuesAction({
      sourceDescription: 'desc',
      fields: ['notARealField'],
      context: {},
    });
    expect('error' in result).toBe(true);
    expect(requireAdminPermission).not.toHaveBeenCalled();
  });

  it('rejects an empty source description', async () => {
    const result = await generateItemFieldValuesAction({
      sourceDescription: '   ',
      fields: ['title'],
      context: {},
    });
    expect(result).toEqual({ error: 'Enter a description first.' });
  });

  it('requires catalog_manage permission before generating', async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({} as never);
    vi.mocked(generateItemFields).mockResolvedValue({ title: 'Generated Title' });

    await generateItemFieldValuesAction({
      sourceDescription: 'desc',
      fields: ['title'],
      context: {},
    });

    expect(requireAdminPermission).toHaveBeenCalledWith('catalog_manage');
  });

  it('returns generated values on success', async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({} as never);
    vi.mocked(generateItemFields).mockResolvedValue({ title: 'Generated Title' });

    const result = await generateItemFieldValuesAction({
      sourceDescription: 'desc',
      fields: ['title'],
      context: {},
    });

    expect(result).toEqual({ values: { title: 'Generated Title' } });
  });

  it('returns an error message when generation fails', async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({} as never);
    vi.mocked(generateItemFields).mockRejectedValue(new Error('OpenAI is down'));

    const result = await generateItemFieldValuesAction({
      sourceDescription: 'desc',
      fields: ['title'],
      context: {},
    });

    expect(result).toEqual({ error: 'OpenAI is down' });
  });
});
