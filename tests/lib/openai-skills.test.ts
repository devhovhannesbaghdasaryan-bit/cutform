import { describe, expect, it, vi } from 'vitest';
import {
  deleteSkillArtifact,
  ensureSkillManifest,
  skillNameFromFileName,
  uploadSkill,
} from '@/lib/openai-skills';

type SkillsClient = Parameters<typeof deleteSkillArtifact>[0];

function fakeOpenAiClient(
  overrides: {
    skillsCreate?: (...args: unknown[]) => unknown;
    skillsDelete?: (...args: unknown[]) => unknown;
    filesDelete?: (...args: unknown[]) => unknown;
  } = {},
) {
  return {
    skills: {
      create: overrides.skillsCreate ?? vi.fn(async () => ({ id: 'skill_abc123' })),
      delete: overrides.skillsDelete ?? vi.fn(async () => ({ id: 'skill_abc123', deleted: true })),
    },
    files: {
      delete: overrides.filesDelete ?? vi.fn(async () => ({ id: 'file-abc123', deleted: true })),
    },
  } as unknown as SkillsClient & Parameters<typeof uploadSkill>[0];
}

describe('skillNameFromFileName', () => {
  it('slugifies the base name and drops the md/txt extension', () => {
    expect(skillNameFromFileName('Night Light Guide.md')).toBe('night-light-guide');
    expect(skillNameFromFileName('LASER_notes.TXT')).toBe('laser-notes');
  });

  it('falls back to a default when nothing usable remains', () => {
    expect(skillNameFromFileName('***.md')).toBe('personalization-skill');
  });
});

describe('ensureSkillManifest', () => {
  it('wraps plain documents in name/description frontmatter', () => {
    const { manifest, name } = ensureSkillManifest('# Guide\n\nContent.', 'night-light-guide');
    expect(name).toBe('night-light-guide');
    expect(manifest).toMatch(/^---\nname: night-light-guide\ndescription: .+\n---\n\n# Guide/);
  });

  it('passes documents with complete frontmatter through unchanged', () => {
    const content = '---\nname: my-skill\ndescription: Does things.\n---\n\nBody.';
    const { manifest, name } = ensureSkillManifest(content, 'fallback');
    expect(manifest).toBe(content);
    expect(name).toBe('my-skill');
  });

  it('adds only the missing frontmatter fields', () => {
    const content = '---\nname: My Skill\n---\nBody.';
    const { manifest, name } = ensureSkillManifest(content, 'fallback');
    expect(name).toBe('my-skill');
    expect(manifest).toMatch(/^---\ndescription: .+\nname: My Skill\n---\nBody\.$/);
  });
});

describe('uploadSkill', () => {
  it('creates a SKILL.md bundle under the skill-name folder and returns the skill id', async () => {
    const client = fakeOpenAiClient();
    const file = new File(['# Guide'], 'Night Light Guide.md', { type: 'text/markdown' });
    await expect(uploadSkill(client, file)).resolves.toBe('skill_abc123');

    const call = vi.mocked(client.skills.create).mock.calls[0][0] as { files: File[] };
    expect(call.files).toHaveLength(1);
    expect(call.files[0].name).toBe('night-light-guide/SKILL.md');
    await expect(call.files[0].text()).resolves.toContain('name: night-light-guide');
  });

  it('throws when the Skills API rejects the upload', async () => {
    const client = fakeOpenAiClient({
      skillsCreate: vi.fn(async () => {
        throw new Error('network error');
      }),
    });
    const file = new File(['# Guide'], 'guide.md', { type: 'text/markdown' });
    await expect(uploadSkill(client, file)).rejects.toThrow('network error');
  });
});

describe('deleteSkillArtifact', () => {
  it('routes skill_ ids to the Skills API', async () => {
    const client = fakeOpenAiClient();
    await deleteSkillArtifact(client, 'skill_abc123');
    expect(client.skills.delete).toHaveBeenCalledWith('skill_abc123');
    expect(client.files.delete).not.toHaveBeenCalled();
  });

  it('routes legacy file- ids to File Storage', async () => {
    const client = fakeOpenAiClient();
    await deleteSkillArtifact(client, 'file-abc123');
    expect(client.files.delete).toHaveBeenCalledWith('file-abc123');
    expect(client.skills.delete).not.toHaveBeenCalled();
  });

  it('swallows errors and logs instead of throwing', async () => {
    const client = fakeOpenAiClient({
      skillsDelete: vi.fn(async () => {
        throw new Error('not found');
      }),
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(deleteSkillArtifact(client, 'skill_missing')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
