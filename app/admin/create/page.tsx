import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Boxes, ImagePlus, Sparkles } from 'lucide-react';
import { generateToyDecorationDraftAction } from '@/app/admin/items/ai-draft-actions';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const actions = [
  {
    href: '/admin/items/new',
    titleKey: 'adminCreate.catalogItemTitle',
    descriptionKey: 'adminCreate.catalogItemHelp',
    icon: Boxes,
  },
  {
    href: '/admin/personalization/boilerplates',
    titleKey: 'adminCreate.boilerplatesTitle',
    descriptionKey: 'adminCreate.boilerplatesHelp',
    icon: Sparkles,
  },
  {
    href: '/admin/generated',
    titleKey: 'adminCreate.reviewTitle',
    descriptionKey: 'adminCreate.reviewHelp',
    icon: ImagePlus,
  },
] as const;

export default async function AdminCreatePage() {
  await requireAdmin();
  const t = await getTranslations();

  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('adminCreate.title')}</h1>
        <p className="text-muted-foreground">{t('adminCreate.subtitle')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-lg border p-5 transition-colors hover:bg-muted/40"
            >
              <Icon className="h-6 w-6" />
              <h2 className="mt-4 text-lg font-semibold">{t(action.titleKey)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t(action.descriptionKey)}</p>
              <span className="mt-4 inline-flex rounded-md border px-3 py-2 text-sm font-medium">
                {t('adminCreate.open')}
              </span>
            </Link>
          );
        })}
      </div>

      <section className="rounded-lg border p-5">
        <div>
          <h2 className="text-lg font-semibold">{t('adminCreate.draftTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('adminCreate.draftHelp')}</p>
        </div>
        <form
          action={generateToyDecorationDraftAction}
          className="mt-5 grid gap-4 md:grid-cols-[180px_1fr]"
        >
          <div className="space-y-2">
            <label htmlFor="targetCategory" className="text-sm font-medium">
              {t('adminCreate.target')}
            </label>
            <select
              id="targetCategory"
              name="targetCategory"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="toys">{t('adminCreate.targetToys')}</option>
              <option value="decorations">{t('adminCreate.targetDecorations')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="prompt" className="text-sm font-medium">
              {t('adminCreate.prompt')}
            </label>
            <textarea
              id="prompt"
              name="prompt"
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={t('adminCreate.promptPlaceholder')}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="referenceFile" className="text-sm font-medium">
              {t('adminCreate.referenceImage')}
            </label>
            <input
              id="referenceFile"
              name="referenceFile"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="block w-full text-sm"
            />
            <p className="text-xs text-muted-foreground">{t('adminCreate.referenceImageHelp')}</p>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('adminCreate.generateDraft')}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
