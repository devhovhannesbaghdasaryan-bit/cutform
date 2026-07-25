import type OpenAI from 'openai';

/**
 * Only ids minted by OpenAI File Storage participate in generation. Legacy
 * free-text values in catalog_items.skill_id (e.g. `skill-1` from seeds) are
 * inert by design — see the 2026-07-25 skill-reference spec.
 */
export function isOpenAiSkillFileId(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('file-');
}

/**
 * Skill file ids for one generation call: product skill first, boilerplate
 * skill second. Legacy ids are dropped; a shared id appears once.
 */
export function collectSkillFileIds(
  itemSkillId: string | null,
  boilerplateSkillFileId: string | null | undefined,
): string[] {
  const ids: string[] = [];
  if (isOpenAiSkillFileId(itemSkillId)) ids.push(itemSkillId);
  if (isOpenAiSkillFileId(boilerplateSkillFileId) && !ids.includes(boilerplateSkillFileId)) {
    ids.push(boilerplateSkillFileId);
  }
  return ids;
}

/**
 * Memoized skill-content fetcher scoped to one action invocation: each unique
 * file id is downloaded once even when several selected boilerplates share
 * the product skill.
 */
export function createSkillTextLoader(
  client: Pick<OpenAI, 'files'>,
): (fileId: string) => Promise<string> {
  const cache = new Map<string, Promise<string>>();
  return (fileId) => {
    let pending = cache.get(fileId);
    if (!pending) {
      pending = Promise.resolve(client.files.content(fileId)).then((response) => response.text());
      cache.set(fileId, pending);
    }
    return pending;
  };
}
