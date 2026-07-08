import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function PersonalizationPage() {
  const t = await getTranslations();
  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('personalization.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('personalization.subtitle')}</p>
      </div>

      <Link
        href="/admin/personalization/boilerplates"
        className="block max-w-sm rounded-lg border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <h2 className="text-lg font-semibold">{t('personalization.libraryCard')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('personalization.libraryCardHelp')}</p>
      </Link>
    </main>
  );
}
