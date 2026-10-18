import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getActiveCurrency } from '@/lib/currency';

const SUPPORT_EMAIL = 'support@uniqraft.org';
const INSTAGRAM_URL = 'https://instagram.com/uniqraft_org';

/** Dark site footer shared by the storefront and account pages. */
export async function SiteFooter() {
  const [t, currency] = await Promise.all([getTranslations(), getActiveCurrency()]);
  const year = new Date().getFullYear();

  const shopLinks = [
    { href: '/catalog?category=night-lights', label: t('category.night-lights.name') },
    { href: '/catalog?category=keepsake-boxes', label: t('category.keepsake-boxes.name') },
    { href: '/catalog?category=anniversary-gifts', label: t('category.anniversary-gifts.name') },
    { href: '/catalog?category=constructors', label: t('category.constructors.name') },
    { href: '/catalog', label: t('landing.categories_all') },
  ];
  const helpLinks = [
    { href: '/#how', label: t('footer.howPersonalization') },
    { href: '/credits', label: t('nav.credits') },
    { href: '/dashboard', label: t('footer.trackOrder') },
    { href: '/privacy', label: t('footer.privacy') },
  ];

  return (
    <footer className="mt-auto border-t border-white/10 bg-slate text-[#C9CED8]">
      <div className="storefront-container py-12">
        <div className="flex flex-wrap gap-x-12 gap-y-8">
          <div className="min-w-0 max-w-sm flex-[2_1_260px]">
            <Image
              src="/brand/uniqraft-logo-dark.png?v=20260704"
              alt="Uniqraft"
              width={132}
              height={32}
              unoptimized
              className="h-8 w-auto"
            />
            <p className="mt-4 text-sm leading-relaxed">{t('footer.tagline')}</p>
          </div>
          <nav
            aria-label={t('footer.shop')}
            className="flex min-w-0 flex-[1_1_150px] flex-col gap-2.5 text-sm"
          >
            <p className="text-[13px] font-extrabold uppercase tracking-wider text-white">
              {t('footer.shop')}
            </p>
            {shopLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
          <nav
            aria-label={t('footer.help')}
            className="flex min-w-0 flex-[1_1_150px] flex-col gap-2.5 text-sm"
          >
            <p className="text-[13px] font-extrabold uppercase tracking-wider text-white">
              {t('footer.help')}
            </p>
            {helpLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-2.5 text-sm">
            <p className="text-[13px] font-extrabold uppercase tracking-wider text-white">
              {t('footer.contact')}
            </p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="transition-colors hover:text-white">
              {SUPPORT_EMAIL}
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
            >
              {t('footer.instagram')}
            </a>
            <p>{t('footer.location')}</p>
          </div>
        </div>
        <div className="mt-9 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5 text-[13px]">
          <p>{t('footer.rights', { year })}</p>
          <p>{t('footer.pricesIn', { currency })}</p>
        </div>
      </div>
    </footer>
  );
}
