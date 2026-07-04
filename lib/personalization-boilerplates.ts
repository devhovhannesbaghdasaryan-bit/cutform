import type { AppLocale } from '@/lib/i18n';

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
