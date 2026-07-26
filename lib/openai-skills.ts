import 'server-only';

import type OpenAI from 'openai';

const DEFAULT_SKILL_NAME = 'personalization-skill';
const DEFAULT_SKILL_DESCRIPTION =
  'Product personalization guidance injected into image generation prompts.';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

/** Kebab-case skill name (Skills API convention), or the default when nothing survives. */
export function slugifySkillName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
  return slug || DEFAULT_SKILL_NAME;
}

/** Skill name derived from an uploaded document's file name. */
export function skillNameFromFileName(fileName: string): string {
  return slugifySkillName(fileName.replace(/\.(md|txt)$/i, ''));
}

/**
 * SKILL.md content carrying the frontmatter the Skills API requires. Documents
 * authored with their own name and description pass through unchanged; missing
 * fields are added, with `fallbackName` as the name. Also returns the skill
 * name used for the bundle's top-level folder.
 */
export function ensureSkillManifest(
  content: string,
  fallbackName: string,
): { manifest: string; name: string } {
  const match = FRONTMATTER.exec(content);
  if (!match) {
    return {
      manifest: `---\nname: ${fallbackName}\ndescription: ${DEFAULT_SKILL_DESCRIPTION}\n---\n\n${content}`,
      name: fallbackName,
    };
  }

  const block = match[1];
  const nameMatch = /^name\s*:\s*(\S.*)$/m.exec(block);
  const name = nameMatch ? slugifySkillName(nameMatch[1].trim()) : fallbackName;
  const additions: string[] = [];
  if (!nameMatch) additions.push(`name: ${fallbackName}`);
  if (!/^description\s*:/m.test(block)) additions.push(`description: ${DEFAULT_SKILL_DESCRIPTION}`);
  if (!additions.length) return { manifest: content, name };

  const body = content.slice(match[0].length);
  return { manifest: `---\n${additions.join('\n')}\n${block}\n---\n${body}`, name };
}

/**
 * Publishes a skill document (.md/.txt) to the OpenAI Skills API so it appears
 * under the dashboard's Skills tab. The document is wrapped as SKILL.md inside
 * the required single top-level folder. Returns the `skill_…` id. Throws on
 * failure.
 */
export async function uploadSkill(client: Pick<OpenAI, 'skills'>, file: File): Promise<string> {
  const { manifest, name } = ensureSkillManifest(
    await file.text(),
    skillNameFromFileName(file.name),
  );
  const bundle = new File([manifest], `${name}/SKILL.md`, { type: 'text/markdown' });
  const created = await client.skills.create({ files: [bundle] });
  return created.id;
}

/**
 * Best-effort delete of a previously uploaded skill: `skill_…` ids go to the
 * Skills API, legacy `file-…` ids (pre-Skills uploads) to File Storage. Never
 * throws.
 */
export async function deleteSkillArtifact(
  client: Pick<OpenAI, 'files' | 'skills'>,
  id: string,
): Promise<void> {
  try {
    if (id.startsWith('skill_')) await client.skills.delete(id);
    else await client.files.delete(id);
  } catch (error) {
    console.error('[openai-skills] failed to delete OpenAI skill', id, error);
  }
}
