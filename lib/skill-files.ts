import 'server-only';

import type OpenAI from 'openai';
import { deleteReferenceFile, uploadSkillFile } from '@/lib/openai-files';
import { isOpenAiSkillFileId } from '@/lib/personalization-skills';
import { uploadToBucket } from '@/lib/storage';

export const SKILL_FILE_MAX_BYTES = 1024 * 1024;

const SKILL_CONTENT_TYPE_BY_EXT = { md: 'text/markdown', txt: 'text/plain' } as const;

type StorageClient = Parameters<typeof uploadToBucket>[0];

/** md/txt extension of a skill file name, or null when unsupported. */
export function skillFileExtension(fileName: string): 'md' | 'txt' | null {
  const match = /\.(md|txt)$/i.exec(fileName);
  return match ? (match[1].toLowerCase() as 'md' | 'txt') : null;
}

/** The non-empty `skillFile` form field, if any. */
export function getSkillFile(formData: FormData): File | null {
  const value = formData.get('skillFile');
  return value instanceof File && value.size > 0 ? value : null;
}

/**
 * Uploads a skill document: OpenAI File Storage first (source of truth), then
 * a recovery copy in the private uploads bucket. If the Supabase copy fails,
 * the just-uploaded OpenAI file is best-effort deleted so no orphan id persists.
 */
export async function uploadSkillAssets(
  openai: Pick<OpenAI, 'files'>,
  supabase: StorageClient,
  userId: string,
  file: File,
): Promise<{ openaiFileId: string; skillPath: string }> {
  const ext = skillFileExtension(file.name);
  if (!ext) throw new Error('Upload .md or .txt skill files only.');
  if (file.size > SKILL_FILE_MAX_BYTES) throw new Error('Skill files must be 1 MB or smaller.');

  const openaiFileId = await uploadSkillFile(openai, file);
  try {
    const skillPath = await uploadToBucket(supabase, {
      bucket: 'uploads',
      path: `${userId}/personalization-skills/${crypto.randomUUID()}.${ext}`,
      body: await file.arrayBuffer(),
      contentType: file.type || SKILL_CONTENT_TYPE_BY_EXT[ext],
    });
    return { openaiFileId, skillPath };
  } catch (error) {
    await deleteReferenceFile(openai, openaiFileId);
    throw error;
  }
}

export interface SkillColumnState {
  skillOpenaiFileId: string | null;
  skillPath: string | null;
}

/**
 * Final skill columns for a save, plus which previous OpenAI file to
 * best-effort delete after the DB write. Upload wins over removeSkill;
 * with neither, the existing attachment is carried through unchanged.
 */
export function resolveSkillColumns(options: {
  uploaded: { openaiFileId: string; skillPath: string } | null;
  removeSkill: boolean;
  existing: SkillColumnState | null;
}): SkillColumnState & { previousOpenaiFileId: string | null } {
  const { uploaded, removeSkill, existing } = options;
  if (uploaded) {
    return {
      skillOpenaiFileId: uploaded.openaiFileId,
      skillPath: uploaded.skillPath,
      previousOpenaiFileId: existing?.skillOpenaiFileId ?? null,
    };
  }
  if (removeSkill) {
    return {
      skillOpenaiFileId: null,
      skillPath: null,
      previousOpenaiFileId: existing?.skillOpenaiFileId ?? null,
    };
  }
  return {
    skillOpenaiFileId: existing?.skillOpenaiFileId ?? null,
    skillPath: existing?.skillPath ?? null,
    previousOpenaiFileId: null,
  };
}

/**
 * Item-form skill semantics: a new upload replaces the attachment, the
 * removeSkill checkbox clears it, otherwise the hidden-input values already
 * on `item` are kept. Mutates `item` and returns the previous OpenAI file id
 * to delete after the catalog row is written (legacy non `file-` ids are
 * never deleted — they were not uploaded through this flow). `getOpenAi` is
 * only invoked when a skill file is actually present, so plain item saves in
 * keyless environments never construct an OpenAI client.
 */
export async function applyItemSkillFields(
  getOpenAi: () => Pick<OpenAI, 'files'>,
  supabase: StorageClient,
  userId: string,
  formData: FormData,
  item: { skillId?: string; skillPath?: string },
): Promise<string | null> {
  const skillFile = getSkillFile(formData);
  const removeSkill = formData.get('removeSkill') === 'on';
  const previous = isOpenAiSkillFileId(item.skillId) ? item.skillId : null;

  if (skillFile) {
    const uploaded = await uploadSkillAssets(getOpenAi(), supabase, userId, skillFile);
    item.skillId = uploaded.openaiFileId;
    item.skillPath = uploaded.skillPath;
    return previous;
  }
  if (removeSkill) {
    item.skillId = undefined;
    item.skillPath = undefined;
    return previous;
  }
  return null;
}
