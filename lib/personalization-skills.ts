import { downloadFromBucket } from '@/lib/storage';

/**
 * Only ids minted by OpenAI File Storage mark a real skill attachment. Legacy
 * free-text values in catalog_items.skill_id (e.g. `skill-1` from seeds) are
 * inert by design — see the 2026-07-25 skill-reference spec.
 */
export function isOpenAiSkillFileId(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('file-');
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
 * OpenAI file id plus the uploads-bucket copy the text is read from. A bare
 * `file-` id without a copy (e.g. set via MCP as a plain string) cannot be
 * injected and does not count.
 */
export function hasInjectableSkill(item: ItemSkillSource): boolean {
  return isOpenAiSkillFileId(item.skill_id) && Boolean(item.skill_path);
}

/**
 * Storage paths of the skill documents for one generation call: product skill
 * first, boilerplate skill second, duplicates dropped. OpenAI forbids
 * downloading the content of `user_data` files, so skill text is read from
 * the uploads-bucket copies; the OpenAI file id acts purely as the
 * attachment marker.
 */
export function collectSkillPaths(
  item: ItemSkillSource,
  boilerplate: BoilerplateSkillSource | null | undefined,
): string[] {
  const paths: string[] = [];
  if (isOpenAiSkillFileId(item.skill_id) && item.skill_path) paths.push(item.skill_path);
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
