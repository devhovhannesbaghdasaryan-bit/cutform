import type { CatalogSeoMetadata } from '@/lib/seo';

export type SeoWarningCode =
  | 'missing_title'
  | 'missing_description'
  | 'short_title'
  | 'long_title'
  | 'short_description'
  | 'long_description'
  | 'missing_social_image'
  | 'missing_localized_metadata'
  | 'private_field_risk';

export interface SeoWarning {
  code: SeoWarningCode;
  message: string;
}

export function validateSeoMetadata(
  metadata: Partial<CatalogSeoMetadata> | null | undefined,
  options: { requireLocalized?: boolean; includesPrivateFields?: boolean } = {},
) {
  const warnings: SeoWarning[] = [];
  const title = metadata?.seo_title?.trim() ?? '';
  const description = metadata?.seo_description?.trim() ?? '';

  if (!title) warnings.push({ code: 'missing_title', message: 'SEO title is missing.' });
  if (!description) {
    warnings.push({ code: 'missing_description', message: 'Meta description is missing.' });
  }
  if (title && title.length < 30) {
    warnings.push({ code: 'short_title', message: 'SEO title is shorter than recommended.' });
  }
  if (title.length > 70) {
    warnings.push({ code: 'long_title', message: 'SEO title is longer than recommended.' });
  }
  if (description && description.length < 80) {
    warnings.push({
      code: 'short_description',
      message: 'Meta description is shorter than recommended.',
    });
  }
  if (description.length > 170) {
    warnings.push({
      code: 'long_description',
      message: 'Meta description is longer than recommended.',
    });
  }
  if (!metadata?.social_image_path) {
    warnings.push({ code: 'missing_social_image', message: 'Social image is missing.' });
  }
  if (options.requireLocalized && (!title || !description)) {
    warnings.push({
      code: 'missing_localized_metadata',
      message: 'Localized SEO metadata is incomplete.',
    });
  }
  if (options.includesPrivateFields) {
    warnings.push({
      code: 'private_field_risk',
      message: 'Private/admin-only fields must not be exposed in structured data.',
    });
  }

  return warnings;
}
