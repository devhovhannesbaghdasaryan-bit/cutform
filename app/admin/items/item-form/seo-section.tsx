import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { APP_LOCALES, type AppLocale } from '@/lib/i18n';
import { type SeoWarningCode, validateSeoMetadata } from '@/lib/seo-validation';
import { AutogenerateButton } from './ai-context';
import type { ItemFormValue, SeoFormValue } from './types';

const SEO_WARNING_KEYS = {
  missing_title: 'adminItems.seo.warnings.missingTitle',
  missing_description: 'adminItems.seo.warnings.missingDescription',
  short_title: 'adminItems.seo.warnings.shortTitle',
  long_title: 'adminItems.seo.warnings.longTitle',
  short_description: 'adminItems.seo.warnings.shortDescription',
  long_description: 'adminItems.seo.warnings.longDescription',
  missing_social_image: 'adminItems.seo.warnings.missingSocialImage',
  missing_localized_metadata: 'adminItems.seo.warnings.missingLocalizedMetadata',
  private_field_risk: 'adminItems.seo.warnings.privateFieldRisk',
} as const satisfies Record<SeoWarningCode, string>;

export function SeoSection({
  item,
  seo,
  seoRecords,
}: {
  item?: Pick<ItemFormValue, 'title' | 'slug' | 'description' | 'thumbnail_path'>;
  seo?: SeoFormValue | null;
  seoRecords?: SeoFormValue[];
}) {
  const t = useTranslations();
  const seoByLocale = new Map<AppLocale, SeoFormValue>();
  if (seo) seoByLocale.set('en', seo);
  seoRecords?.forEach((record) => {
    if (record.locale) seoByLocale.set(record.locale, record);
  });

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">{t('adminItems.seo.heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('adminItems.seo.subtitle')}</p>
      </div>
      {APP_LOCALES.map((locale) => {
        const currentSeo = seoByLocale.get(locale);
        const warnings = validateSeoMetadata(
          {
            seo_title: currentSeo?.seo_title ?? null,
            seo_description: currentSeo?.seo_description ?? null,
            seo_slug: currentSeo?.seo_slug ?? item?.slug ?? null,
            keywords: currentSeo?.keywords ?? [],
            og_title: currentSeo?.og_title ?? null,
            og_description: currentSeo?.og_description ?? null,
            social_image_path: currentSeo?.social_image_path ?? item?.thumbnail_path ?? null,
            noindex: currentSeo?.noindex ?? false,
          },
          { requireLocalized: locale !== 'en' },
        );
        const previewTitle =
          currentSeo?.seo_title || item?.title || t('adminItems.seo.previewTitle');
        const previewDescription =
          currentSeo?.seo_description ||
          item?.description ||
          t('adminItems.seo.previewDescription');

        return (
          <div key={locale} className="space-y-4 rounded-md border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide">{locale}</h3>
                <p className="text-xs text-muted-foreground">
                  {currentSeo?.generated_by_ai
                    ? t('adminItems.seo.generatedByAi')
                    : t('adminItems.seo.manualMetadata')}
                  {' - '}
                  {currentSeo?.reviewed_by_admin
                    ? t('adminItems.seo.reviewed')
                    : t('adminItems.seo.needsReview')}
                </p>
              </div>
              {warnings.length > 0 && (
                <div className="warning-panel rounded-md border px-3 py-2 text-xs">
                  {warnings.map((warning) => (
                    <div key={warning.code}>{t(SEO_WARNING_KEYS[warning.code])}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-md border bg-background p-3">
              <p className="truncate text-sm font-medium text-blue-700">{previewTitle}</p>
              <p className="truncate text-xs text-success">
                /items/{currentSeo?.seo_slug || item?.slug || 'item-slug'}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {previewDescription}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`seoTitle_${locale}`}>{t('adminItems.seo.seoTitle')}</Label>
                  <AutogenerateButton field={`seoTitle_${locale}`} />
                </div>
                <Input
                  id={`seoTitle_${locale}`}
                  name={`seoTitle_${locale}`}
                  defaultValue={currentSeo?.seo_title ?? ''}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`seoKeywords_${locale}`}>{t('adminItems.seo.keywords')}</Label>
                  <AutogenerateButton field={`seoKeywords_${locale}`} />
                </div>
                <Input
                  id={`seoKeywords_${locale}`}
                  name={`seoKeywords_${locale}`}
                  defaultValue={currentSeo?.keywords?.join(', ') ?? ''}
                  placeholder={t('adminItems.seo.keywordsPlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`seoDescription_${locale}`}>
                  {t('adminItems.seo.metaDescription')}
                </Label>
                <AutogenerateButton field={`seoDescription_${locale}`} />
              </div>
              <Textarea
                id={`seoDescription_${locale}`}
                name={`seoDescription_${locale}`}
                defaultValue={currentSeo?.seo_description ?? ''}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`ogTitle_${locale}`}>{t('adminItems.seo.ogTitle')}</Label>
                  <AutogenerateButton field={`ogTitle_${locale}`} />
                </div>
                <Input
                  id={`ogTitle_${locale}`}
                  name={`ogTitle_${locale}`}
                  defaultValue={currentSeo?.og_title ?? ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`socialImagePath_${locale}`}>
                  {t('adminItems.seo.socialImagePath')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('adminItems.seo.socialImageHelp')}
                </p>
                <Input
                  id={`socialImagePath_${locale}`}
                  name={`socialImagePath_${locale}`}
                  defaultValue={currentSeo?.social_image_path ?? ''}
                />
                <Input
                  id={`socialImageFile_${locale}`}
                  name={`socialImageFile_${locale}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`ogDescription_${locale}`}>
                  {t('adminItems.seo.ogDescription')}
                </Label>
                <AutogenerateButton field={`ogDescription_${locale}`} />
              </div>
              <Textarea
                id={`ogDescription_${locale}`}
                name={`ogDescription_${locale}`}
                defaultValue={currentSeo?.og_description ?? ''}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}
