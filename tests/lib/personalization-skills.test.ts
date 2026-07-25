import { describe, expect, it, vi } from 'vitest';
import {
  collectSkillFileIds,
  createSkillTextLoader,
  isOpenAiSkillFileId,
} from '@/lib/personalization-skills';

describe('isOpenAiSkillFileId', () => {
  it('accepts ids starting with file-', () => {
    expect(isOpenAiSkillFileId('file-abc123')).toBe(true);
  });

  it('rejects legacy seed ids, null, undefined, and empty strings', () => {
    expect(isOpenAiSkillFileId('skill-1')).toBe(false);
    expect(isOpenAiSkillFileId(null)).toBe(false);
    expect(isOpenAiSkillFileId(undefined)).toBe(false);
    expect(isOpenAiSkillFileId('')).toBe(false);
  });
});

describe('collectSkillFileIds', () => {
  it('returns the product skill before the boilerplate skill', () => {
    expect(collectSkillFileIds('file-item', 'file-boiler')).toEqual(['file-item', 'file-boiler']);
  });

  it('skips a legacy non file- item skill id', () => {
    expect(collectSkillFileIds('skill-1', 'file-boiler')).toEqual(['file-boiler']);
  });

  it('includes only the item skill when the boilerplate has none', () => {
    expect(collectSkillFileIds('file-item', null)).toEqual(['file-item']);
    expect(collectSkillFileIds('file-item', undefined)).toEqual(['file-item']);
  });

  it('dedupes when item and boilerplate share the same file id', () => {
    expect(collectSkillFileIds('file-same', 'file-same')).toEqual(['file-same']);
  });

  it('returns an empty list when nothing is attached', () => {
    expect(collectSkillFileIds(null, null)).toEqual([]);
  });
});

describe('createSkillTextLoader', () => {
  function fakeClient(content: ReturnType<typeof vi.fn>) {
    return { files: { content } } as unknown as Parameters<typeof createSkillTextLoader>[0];
  }

  it('returns the fetched text', async () => {
    const content = vi.fn(async () => ({ text: async () => 'skill guidance' }));
    const load = createSkillTextLoader(fakeClient(content));
    await expect(load('file-a')).resolves.toBe('skill guidance');
    expect(content).toHaveBeenCalledWith('file-a');
  });

  it('fetches each unique file id only once', async () => {
    const content = vi.fn(async (fileId: string) => ({ text: async () => `text of ${fileId}` }));
    const load = createSkillTextLoader(fakeClient(content));
    await expect(load('file-a')).resolves.toBe('text of file-a');
    await expect(load('file-a')).resolves.toBe('text of file-a');
    await expect(load('file-b')).resolves.toBe('text of file-b');
    expect(content).toHaveBeenCalledTimes(2);
  });

  it('propagates fetch failures', async () => {
    const content = vi.fn(async () => {
      throw new Error('file not found');
    });
    const load = createSkillTextLoader(fakeClient(content));
    await expect(load('file-missing')).rejects.toThrow('file not found');
  });
});
