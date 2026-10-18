import Link from 'next/link';
import { Coins, Search, ShieldCheck, ShoppingCart, UserCircle } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { LocaleCurrencyMenu } from '@/components/locale-currency-menu';
import { MobileNavMenu } from '@/components/mobile-nav-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getCurrentUserRole } from '@/lib/admin';
import { getActiveCartItemCount } from '@/lib/cart';
import { getCartSessionId } from '@/lib/cart-session';
import { getCreditBalanceForDisplay } from '@/lib/credits';
import { getActiveCurrency, listEnabledCurrencies } from '@/lib/currency';
import { getTranslations } from 'next-intl/server';
import { getRequestLocale } from '@/lib/i18n-server';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';

const PRIMARY_LINKS = [
  { href: '/catalog', key: 'nav.shop' },
  { href: '/catalog?category=night-lights', key: 'nav.nightLights' },
  { href: '/catalog?category=anniversary-gifts', key: 'nav.gifts' },
  { href: '/#how', key: 'nav.howItWorks' },
] as const;

/**
 * The one header for every page, storefront and account alike: logo, primary
 * navigation, catalog search, the language/currency menu, credits, cart and
 * the account entry. Guests see log in / sign up instead of the account items.
 */
export async function MarketplaceHeader() {
  const supabase = await getServerSupabase();
  const [locale, t, user, activeCurrency, currencies] = await Promise.all([
    getRequestLocale(),
    getTranslations(),
    getCurrentUser(),
    getActiveCurrency(),
    listEnabledCurrencies(),
  ]);
  const role = user ? await getCurrentUserRole() : null;
  const sessionId = user ? null : await getCartSessionId();
  const [creditBalance, cartCount] = user
    ? await Promise.all([
        getCreditBalanceForDisplay(supabase, user.id),
        getActiveCartItemCount(supabase, { userId: user.id }),
      ])
    : [0, sessionId ? await getActiveCartItemCount(getServiceSupabase(), { sessionId }) : 0];
  const isAdmin = role === 'admin';

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="storefront-container flex min-h-[68px] flex-wrap items-center gap-x-5 gap-y-2 py-2.5">
        <Link
          href="/"
          aria-label={t('nav.home')}
          className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <BrandLogo />
        </Link>

        <nav aria-label={t('nav.primary')} className="hidden items-center gap-0.5 lg:flex">
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className="inline-flex h-10 items-center rounded-lg px-3 text-[14.5px] font-semibold text-foreground transition-colors hover:bg-accent"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <form
          action="/catalog"
          method="get"
          className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1 sm:basis-56"
        >
          <label htmlFor="site-search" className="sr-only">
            {t('nav.search')}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="site-search"
              name="q"
              type="search"
              placeholder={t('nav.searchPlaceholder')}
              className="h-10 w-full rounded-full border border-input bg-card pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </form>

        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-1.5">
          <LocaleCurrencyMenu
            activeLocale={locale}
            activeCurrency={activeCurrency}
            currencies={currencies}
            labels={{
              menu: t('nav.localeCurrency'),
              language: t('nav.language'),
              currency: t('nav.currency'),
            }}
          />
          <ThemeToggle className="hidden sm:inline-flex" label={t('nav.toggleTheme')} />
          {user ? (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/credits" aria-label={t('nav.creditsCount', { count: creditBalance })}>
                <Coins
                  className="h-4 w-4 text-gold-foreground/70 dark:text-gold"
                  aria-hidden="true"
                />
                {t('nav.creditsShort', { count: creditBalance })}
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href="/cart" aria-label={t('nav.cartCount', { count: cartCount })}>
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              {cartCount}
            </Link>
          </Button>
          {user ? (
            <>
              {isAdmin ? (
                <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
                  <Link href="/admin">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {t('nav.admin')}
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="ink" size="sm" className="hidden sm:inline-flex">
                <Link href="/dashboard">
                  <UserCircle className="h-4 w-4" aria-hidden="true" />
                  {t('nav.account')}
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">{t('auth.login')}</Link>
              </Button>
              <Button asChild variant="ink" size="sm" className="hidden sm:inline-flex">
                <Link href="/register">{t('auth.signup')}</Link>
              </Button>
            </>
          )}
          <MobileNavMenu
            isAuthenticated={Boolean(user)}
            isAdmin={isAdmin}
            creditBalance={creditBalance}
            labels={{
              menu: t('nav.menu'),
              theme: t('nav.theme'),
              catalog: t('nav.shop'),
              nightLights: t('nav.nightLights'),
              gifts: t('nav.gifts'),
              howItWorks: t('nav.howItWorks'),
              credits: t('nav.credits'),
              dashboard: t('nav.account'),
              admin: t('nav.admin'),
              profile: t('nav.profile'),
              login: t('auth.login'),
              signup: t('auth.signup'),
            }}
          />
        </div>
      </div>
    </header>
  );
}
