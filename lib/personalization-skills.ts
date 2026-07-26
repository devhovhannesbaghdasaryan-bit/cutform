import { downloadFromBucket } from '@/lib/storage';

/**
 * Only ids minted by OpenAI mark a real skill attachment: `skill_…` from the
 * Skills API, or `file-…` from File Storage (rows uploaded before the Skills
 * API migration). Legacy free-text values in catalog_items.skill_id (e.g.
 * `skill-1` from seeds — hyphen, not underscore) are inert by design — see
 * the 2026-07-25 skill-reference spec.
 */
export function isOpenAiSkillId(value: string | null | undefined): value is string {
  return typeof value === 'string' && (value.startsWith('skill_') || value.startsWith('file-'));
}

export interface ItemSkillSource {
  skill_id: string | null;
  skill_path: string | null;
}

export interface BoilerplateSkillSource {
  skill_openai_file_id: string | null;
  skill_path: string | null;
}

/**
 * True when the item carries a skill uploaded through the admin form: a real
 * OpenAI skill id plus the uploads-bucket copy the text is read from. A bare
 * id without a copy (e.g. set via MCP as a plain string) cannot be injected
 * and does not count.
 */
export function hasInjectableSkill(item: ItemSkillSource): boolean {
  return isOpenAiSkillId(item.skill_id) && Boolean(item.skill_path);
}

/**
 * Storage paths of the skill documents for one generation call: product skill
 * first, boilerplate skill second, duplicates dropped. Skill text is read
 * from the uploads-bucket copies; the OpenAI-side skill acts purely as the
 * attachment marker (image generation cannot attach Skills API tools, and
 * legacy `user_data` files forbid content download).
 */
export function collectSkillPaths(
  item: ItemSkillSource,
  boilerplate: BoilerplateSkillSource | null | undefined,
): string[] {
  const paths: string[] = [];
  if (isOpenAiSkillId(item.skill_id) && item.skill_path) paths.push(item.skill_path);
  if (
    boilerplate?.skill_openai_file_id &&
    boilerplate.skill_path &&
    !paths.includes(boilerplate.skill_path)
  ) {
    paths.push(boilerplate.skill_path);
  }
  return paths;
}

/**
 * Memoized skill-content fetcher scoped to one action invocation: each unique
 * path is downloaded once even when several selected boilerplates share the
 * product skill. Requires a service-role client — skill copies live under the
 * uploading admin's folder in the private uploads bucket, which customer
 * sessions cannot read.
 */
export function createSkillTextLoader(
  supabase: Parameters<typeof downloadFromBucket>[0],
): (path: string) => Promise<string> {
  const cache = new Map<string, Promise<string>>();
  return (path) => {
    let pending = cache.get(path);
    if (!pending) {
      pending = downloadFromBucket(supabase, 'uploads', path).then((blob) => blob.text());
      cache.set(path, pending);
    }
    return pending;
  };
}
