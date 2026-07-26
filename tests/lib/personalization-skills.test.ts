import { describe, expect, it, vi } from 'vitest';
import {
  collectSkillPaths,
  createSkillTextLoader,
  hasInjectableSkill,
  isOpenAiSkillId,
} from '@/lib/personalization-skills';

const NO_SKILL_ITEM = { skill_id: null, skill_path: null };
const SKILL_ITEM = { skill_id: 'file-item', skill_path: 'admin-1/personalization-skills/item.md' };
const SKILL_BOILERPLATE = {
  skill_openai_file_id: 'file-boiler',
  skill_path: 'admin-1/personalization-skills/boiler.md',
};
const NO_SKILL_BOILERPLATE = { skill_openai_file_id: null, skill_path: null };

describe('isOpenAiSkillId', () => {
  it('accepts Skills API ids and legacy File Storage ids', () => {
    expect(isOpenAiSkillId('skill_abc123')).toBe(true);
    expect(isOpenAiSkillId('file-abc123')).toBe(true);
  });

  it('rejects legacy seed ids (hyphen), null, undefined, and empty strings', () => {
    expect(isOpenAiSkillId('skill-1')).toBe(false);
    expect(isOpenAiSkillId(null)).toBe(false);
    expect(isOpenAiSkillId(undefined)).toBe(false);
    expect(isOpenAiSkillId('')).toBe(false);
  });
});

describe('hasInjectableSkill', () => {
  it('is true only with a real OpenAI id AND a bucket copy path', () => {
    expect(hasInjectableSkill(SKILL_ITEM)).toBe(true);
    expect(hasInjectableSkill({ skill_id: 'skill_abc', skill_path: 'x/y.md' })).toBe(true);
  });

  it('is false for a legacy id even with a path', () => {
    expect(hasInjectableSkill({ skill_id: 'skill-1', skill_path: 'x/y.md' })).toBe(false);
  });

  it('is false for a bare file- id without a bucket copy', () => {
    expect(hasInjectableSkill({ skill_id: 'file-abc', skill_path: null })).toBe(false);
  });

  it('is false with no skill at all', () => {
    expect(hasInjectableSkill(NO_SKILL_ITEM)).toBe(false);
  });
});

describe('collectSkillPaths', () => {
  it('returns the product skill path before the boilerplate skill path', () => {
    expect(collectSkillPaths(SKILL_ITEM, SKILL_BOILERPLATE)).toEqual([
      SKILL_ITEM.skill_path,
      SKILL_BOILERPLATE.skill_path,
    ]);
  });

  it('skips an item whose skill_id is legacy even when a path exists', () => {
    expect(
      collectSkillPaths({ skill_id: 'skill-1', skill_path: 'x/y.md' }, SKILL_BOILERPLATE),
    ).toEqual([SKILL_BOILERPLATE.skill_path]);
  });

  it('skips an item with a file- id but no bucket copy', () => {
    expect(collectSkillPaths({ skill_id: 'file-abc', skill_path: null }, SKILL_BOILERPLATE)).toEqual(
      [SKILL_BOILERPLATE.skill_path],
    );
  });

  it('skips a boilerplate with an id but no bucket copy', () => {
    expect(
      collectSkillPaths(SKILL_ITEM, { skill_openai_file_id: 'file-boiler', skill_path: null }),
    ).toEqual([SKILL_ITEM.skill_path]);
  });

  it('includes only the item skill when the boilerplate has none (or is absent)', () => {
    expect(collectSkillPaths(SKILL_ITEM, NO_SKILL_BOILERPLATE)).toEqual([SKILL_ITEM.skill_path]);
    expect(collectSkillPaths(SKILL_ITEM, null)).toEqual([SKILL_ITEM.skill_path]);
    expect(collectSkillPaths(SKILL_ITEM, undefined)).toEqual([SKILL_ITEM.skill_path]);
  });

  it('dedupes when item and boilerplate share the same copy path', () => {
    const shared = { skill_openai_file_id: 'file-other', skill_path: SKILL_ITEM.skill_path };
    expect(collectSkillPaths(SKILL_ITEM, shared)).toEqual([SKILL_ITEM.skill_path]);
  });

  it('returns an empty list when nothing is attached', () => {
    expect(collectSkillPaths(NO_SKILL_ITEM, NO_SKILL_BOILERPLATE)).toEqual([]);
    expect(collectSkillPaths(NO_SKILL_ITEM, null)).toEqual([]);
  });
});

describe('createSkillTextLoader', () => {
  function fakeSupabase(download: ReturnType<typeof vi.fn>) {
    const from = vi.fn(() => ({ download }));
    const client = { storage: { from } } as unknown as Parameters<
      typeof createSkillTextLoader
    >[0];
    return { client, from, download };
  }

  it('downloads the copy from the uploads bucket and returns its text', async () => {
    const { client, from, download } = fakeSupabase(
      vi.fn(async () => ({ data: new Blob(['skill guidance']), error: null })),
    );
    const load = createSkillTextLoader(client);
    await expect(load('admin-1/personalization-skills/item.md')).resolves.toBe('skill guidance');
    expect(from).toHaveBeenCalledWith('uploads');
    expect(download).toHaveBeenCalledWith('admin-1/personalization-skills/item.md');
  });

  it('downloads each unique path only once', async () => {
    const { client, download } = fakeSupabase(
      vi.fn(async (path: string) => ({ data: new Blob([`text of ${path}`]), error: null })),
    );
    const load = createSkillTextLoader(client);
    await expect(load('a.md')).resolves.toBe('text of a.md');
    await expect(load('a.md')).resolves.toBe('text of a.md');
    await expect(load('b.md')).resolves.toBe('text of b.md');
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('propagates download failures', async () => {
    const { client } = fakeSupabase(
      vi.fn(async () => ({ data: null, error: { message: 'not found' } })),
    );
    const load = createSkillTextLoader(client);
    await expect(load('missing.md')).rejects.toThrow('not found');
  });
});
