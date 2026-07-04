import Link from 'next/link';
import { Blocks, Gift, Lamp, Megaphone, Puzzle } from 'lucide-react';
import { getRequestLocale } from '@/lib/i18n-server';
import { translate } from '@/lib/i18n';

const categories = [
  { slug: 'toys', icon: Gift },
  { slug: 'constructors', icon: Puzzle },
  { slug: 'decorations', icon: Blocks },
  { slug: 'nightLights', icon: Lamp, href: '/personalization/night-lights' },
  { slug: 'banners', icon: Megaphone },
];

export default async function PersonalizationPage() {
  const locale = await getRequestLocale();
  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{translate(locale, 'personalization.title')}</h1>
        <p className="mt-2 text-muted-foreground">{translate(locale, 'personalization.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const Icon = category.icon;
          const content = (
            <>
              <div className="flex items-start justify-between gap-4">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {translate(locale, category.href ? 'personalization.available' : 'personalization.comingSoon')}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold">{translate(locale, `personalization.${category.slug}`)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {translate(locale, category.href ? 'personalization.manage' : 'personalization.unavailable')}
              </p>
            </>
          );

          return category.href ? (
            <Link
              key={category.slug}
              href={category.href}
              className="rounded-lg border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {content}
            </Link>
          ) : (
            <div key={category.slug} aria-disabled="true" className="cursor-not-allowed rounded-lg border bg-muted/20 p-5 opacity-60">
              {content}
            </div>
          );
        })}
      </div>
    </main>
  );
}
