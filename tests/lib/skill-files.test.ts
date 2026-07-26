import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/storage', () => ({ uploadToBucket: vi.fn() }));

import { uploadToBucket } from '@/lib/storage';
import {
  applyItemSkillFields,
  getSkillFile,
  resolveSkillColumns,
  skillFileExtension,
  uploadSkillAssets,
} from '@/lib/skill-files';

type OpenAiFilesClient = Parameters<typeof uploadSkillAssets>[0];
type StorageClient = Parameters<typeof uploadSkillAssets>[1];

function fakeOpenAi(
  overrides: { create?: (...args: unknown[]) => unknown; del?: (...args: unknown[]) => unknown } = {},
) {
  return {
    skills: {
      create: overrides.create ?? vi.fn(async () => ({ id: 'skill_new' })),
      delete: overrides.del ?? vi.fn(async () => ({ id: 'skill_new', deleted: true })),
    },
    files: {
      delete: vi.fn(async () => ({ id: 'file-old', deleted: true })),
    },
  } as unknown as OpenAiFilesClient;
}

const storageClient = {} as StorageClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(uploadToBucket).mockImplementation(async (_client, { path }) => path);
});

describe('skillFileExtension', () => {
  it('maps .md and .txt (case-insensitive) to their extensions', () => {
    expect(skillFileExtension('guide.md')).toBe('md');
    expect(skillFileExtension('GUIDE.TXT')).toBe('txt');
  });

  it('returns null for anything else', () => {
    expect(skillFileExtension('image.png')).toBeNull();
    expect(skillFileExtension('archive.md.zip')).toBeNull();
    expect(skillFileExtension('noextension')).toBeNull();
  });
});

describe('getSkillFile', () => {
  it('returns the non-empty skillFile entry', () => {
    const formData = new FormData();
    const file = new File(['# Skill'], 'skill.md', { type: 'text/markdown' });
    formData.set('skillFile', file);
    expect(getSkillFile(formData)).toBe(file);
  });

  it('returns null for a missing or empty file input', () => {
    expect(getSkillFile(new FormData())).toBeNull();
    const formData = new FormData();
    formData.set('skillFile', new File([], 'empty.md', { type: 'text/markdown' }));
    expect(getSkillFile(formData)).toBeNull();
  });
});

describe('uploadSkillAssets', () => {
  it('creates an OpenAI skill then copies to Supabase under personalization-skills', async () => {
    const openai = fakeOpenAi();
    const file = new File(['# Skill'], 'skill.md', { type: 'text/markdown' });
    const result = await uploadSkillAssets(openai, storageClient, 'user-1', file);
    expect(result.openaiFileId).toBe('skill_new');
    expect(result.skillPath).toMatch(/^user-1\/personalization-skills\/[0-9a-f-]+\.md$/);
    expect(uploadToBucket).toHaveBeenCalledWith(
      storageClient,
      expect.objectContaining({ bucket: 'uploads', contentType: 'text/markdown' }),
    );
  });

  it('rejects unsupported extensions before uploading anything', async () => {
    const openai = fakeOpenAi();
    const file = new File(['x'], 'skill.pdf', { type: 'application/pdf' });
    await expect(uploadSkillAssets(openai, storageClient, 'user-1', file)).rejects.toThrow(
      'Upload .md or .txt skill files only.',
    );
    expect(openai.skills.create).not.toHaveBeenCalled();
  });

  it('rejects files over 1 MB before uploading anything', async () => {
    const openai = fakeOpenAi();
    const file = new File([new Uint8Array(1024 * 1024 + 1)], 'big.md', { type: 'text/markdown' });
    await expect(uploadSkillAssets(openai, storageClient, 'user-1', file)).rejects.toThrow(
      'Skill files must be 1 MB or smaller.',
    );
    expect(openai.skills.create).not.toHaveBeenCalled();
  });

  it('deletes the OpenAI skill and rethrows when the Supabase copy fails', async () => {
    vi.mocked(uploadToBucket).mockRejectedValueOnce(new Error('bucket unavailable'));
    const openai = fakeOpenAi();
    const file = new File(['# Skill'], 'skill.md', { type: 'text/markdown' });
    await expect(uploadSkillAssets(openai, storageClient, 'user-1', file)).rejects.toThrow(
      'bucket unavailable',
    );
    expect(openai.skills.delete).toHaveBeenCalledWith('skill_new');
  });
});

describe('resolveSkillColumns', () => {
  const existing = { skillOpenaiFileId: 'file-old', skillPath: 'user-1/personalization-skills/old.md' };

  it('uses the uploaded skill and marks the previous one for deletion', () => {
    expect(
      resolveSkillColumns({
        uploaded: { openaiFileId: 'file-new-skill', skillPath: 'user-1/personalization-skills/new.md' },
        removeSkill: false,
        existing,
      }),
    ).toEqual({
      skillOpenaiFileId: 'file-new-skill',
      skillPath: 'user-1/personalization-skills/new.md',
      previousOpenaiFileId: 'file-old',
    });
  });

  it('clears both columns on removeSkill and marks the previous file for deletion', () => {
    expect(resolveSkillColumns({ uploaded: null, removeSkill: true, existing })).toEqual({
      skillOpenaiFileId: null,
      skillPath: null,
      previousOpenaiFileId: 'file-old',
    });
  });

  it('carries the existing skill through an unrelated save', () => {
    expect(resolveSkillColumns({ uploaded: null, removeSkill: false, existing })).toEqual({
      skillOpenaiFileId: 'file-old',
      skillPath: existing.skillPath,
      previousOpenaiFileId: null,
    });
  });

  it('handles a brand-new record with no skill', () => {
    expect(resolveSkillColumns({ uploaded: null, removeSkill: false, existing: null })).toEqual({
      skillOpenaiFileId: null,
      skillPath: null,
      previousOpenaiFileId: null,
    });
  });
});

describe('applyItemSkillFields', () => {
  it('writes the uploaded file id into skillId and returns the previous id', async () => {
    const openai = fakeOpenAi();
    const formData = new FormData();
    formData.set('skillFile', new File(['# Skill'], 'skill.md', { type: 'text/markdown' }));
    const item: { skillId?: string; skillPath?: string } = {
      skillId: 'file-old',
      skillPath: 'user-1/personalization-skills/old.md',
    };
    await expect(
      applyItemSkillFields(() => openai, storageClient, 'user-1', formData, item),
    ).resolves.toBe('file-old');
    expect(item.skillId).toBe('skill_new');
    expect(item.skillPath).toMatch(/^user-1\/personalization-skills\//);
  });

  it('leaves the item untouched without an upload or removal', async () => {
    const openai = fakeOpenAi();
    const item: { skillId?: string; skillPath?: string } = { skillId: 'file-old' };
    await expect(
      applyItemSkillFields(() => openai, storageClient, 'user-1', new FormData(), item),
    ).resolves.toBeNull();
    expect(item.skillId).toBe('file-old');
  });

  it('clears the skill fields on removeSkill and returns the previous id', async () => {
    const openai = fakeOpenAi();
    const formData = new FormData();
    formData.set('removeSkill', 'on');
    const item: { skillId?: string; skillPath?: string } = {
      skillId: 'file-old',
      skillPath: 'user-1/personalization-skills/old.md',
    };
    await expect(
      applyItemSkillFields(() => openai, storageClient, 'user-1', formData, item),
    ).resolves.toBe('file-old');
    expect(item.skillId).toBeUndefined();
    expect(item.skillPath).toBeUndefined();
  });

  it('never reports a legacy free-text id for deletion', async () => {
    const openai = fakeOpenAi();
    const formData = new FormData();
    formData.set('removeSkill', 'on');
    const item: { skillId?: string; skillPath?: string } = { skillId: 'skill-1' };
    await expect(
      applyItemSkillFields(() => openai, storageClient, 'user-1', formData, item),
    ).resolves.toBeNull();
    expect(item.skillId).toBeUndefined();
  });

  it('never invokes the OpenAI client getter without a skill file to upload', async () => {
    const getOpenAi = vi.fn(() => {
      throw new Error('should not be called');
    });
    const item: { skillId?: string; skillPath?: string } = {};
    await expect(
      applyItemSkillFields(getOpenAi, storageClient, 'user-1', new FormData(), item),
    ).resolves.toBeNull();
    expect(getOpenAi).not.toHaveBeenCalled();
  });
});
