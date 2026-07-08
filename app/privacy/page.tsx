import type { Metadata } from 'next';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('legal.privacy.meta_title'),
    description: t('legal.privacy.meta_description'),
  };
}

export default async function PrivacyPolicyPage() {
  const t = await getTranslations();

  const collectItems = [
    { key: 'account', text: t('legal.privacy.collect_account') },
    { key: 'order', text: t('legal.privacy.collect_order') },
    { key: 'content', text: t('legal.privacy.collect_content') },
    { key: 'payment', text: t('legal.privacy.collect_payment') },
    { key: 'technical', text: t('legal.privacy.collect_technical') },
  ];

  const shareItems = [
    { key: 'supabase', text: t('legal.privacy.share_supabase') },
    { key: 'openai', text: t('legal.privacy.share_openai') },
    { key: 'ameria', text: t('legal.privacy.share_ameria') },
    { key: 'social', text: t('legal.privacy.share_social') },
  ];

  return (
    <>
      <MarketplaceHeader />
      <main className="container max-w-3xl space-y-10 py-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('legal.privacy.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('legal.privacy.updated')}</p>
          <p className="text-base leading-7 text-muted-foreground">{t('legal.privacy.intro')}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('legal.privacy.collect_title')}</h2>
          <ul className="list-disc space-y-2 pl-5 text-base leading-7 text-muted-foreground">
            {collectItems.map((item) => (
              <li key={item.key}>{item.text}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('legal.privacy.use_title')}</h2>
          <p className="text-base leading-7 text-muted-foreground">
            {t('legal.privacy.use_body')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('legal.privacy.share_title')}</h2>
          <p className="text-base leading-7 text-muted-foreground">
            {t('legal.privacy.share_intro')}
          </p>
          <ul className="list-disc space-y-2 pl-5 text-base leading-7 text-muted-foreground">
            {shareItems.map((item) => (
              <li key={item.key}>{item.text}</li>
            ))}
          </ul>
          <p className="text-base leading-7 text-muted-foreground">
            {t('legal.privacy.share_outro')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('legal.privacy.cookies_title')}</h2>
          <p className="text-base leading-7 text-muted-foreground">
            {t('legal.privacy.cookies_body')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('legal.privacy.retention_title')}</h2>
          <p className="text-base leading-7 text-muted-foreground">
            {t('legal.privacy.retention_body')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('legal.privacy.rights_title')}</h2>
          <p className="text-base leading-7 text-muted-foreground">
            {t('legal.privacy.rights_body')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('legal.privacy.children_title')}</h2>
          <p className="text-base leading-7 text-muted-foreground">
            {t('legal.privacy.children_body')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('legal.privacy.transfers_title')}</h2>
          <p className="text-base leading-7 text-muted-foreground">
            {t('legal.privacy.transfers_body')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('legal.privacy.changes_title')}</h2>
          <p className="text-base leading-7 text-muted-foreground">
            {t('legal.privacy.changes_body')}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('legal.privacy.contact_title')}</h2>
          <p className="text-base leading-7 text-muted-foreground">
            {t('legal.privacy.contact_body')}
          </p>
        </section>
      </main>
    </>
  );
}
