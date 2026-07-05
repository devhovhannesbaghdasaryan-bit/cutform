import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppLocale } from '@/lib/i18n';
import { downloadFromBucket } from '@/lib/storage';
import type { TypedSupabaseClient } from '@/lib/supabase/types';

export interface PersonalizationBoilerplate {
  id: string;
  model_id: string;
  admin_name: string;
  name_en: string | null;
  name_hy: string | null;
  name_ru: string | null;
  image_path: string;
  manufacturing_process: string;
  generation_instruction: string;
  generate_hidden_svg: boolean;
  is_active: boolean;
  sort_order: number;
}

export function getBoilerplateName(
  boilerplate: Pick<PersonalizationBoilerplate, 'admin_name' | 'name_en' | 'name_hy' | 'name_ru'>,
  locale: AppLocale,
) {
  const localized = locale === 'am'
    ? boilerplate.name_hy
    : locale === 'ru'
      ? boilerplate.name_ru
      : boilerplate.name_en;
  return localized?.trim() || boilerplate.name_en?.trim() || boilerplate.admin_name;
}

/**
 * Loads a boilerplate reference image — from `public/` when the path starts
 * with `/`, otherwise from the `catalog-assets` bucket — as a `File` ready to
 * attach to an image-generation request.
 */
export async function loadBoilerplate(
  supabase: Pick<TypedSupabaseClient, 'storage'>,
  reference: PersonalizationBoilerplate,
) {
  let bytes: Uint8Array;
  if (reference.image_path.startsWith('/')) {
    bytes = new Uint8Array(await readFile(path.join(process.cwd(), 'public', ...reference.image_path.split('/').filter(Boolean))));
  } else {
    const data = await downloadFromBucket(
      supabase,
      'catalog-assets',
      reference.image_path,
      'Unable to load boilerplate image.',
    );
    bytes = new Uint8Array(await data.arrayBuffer());
  }
  const extension = reference.image_path.split('.').pop()?.toLowerCase();
  const mime = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : extension === 'svg' ? 'image/svg+xml' : 'image/jpeg';
  return new File([Uint8Array.from(bytes).buffer], `boilerplate.${extension || 'jpg'}`, { type: mime });
}
