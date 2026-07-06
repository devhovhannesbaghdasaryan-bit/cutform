import Link from 'next/link';
import { Coins, LayoutDashboard, ShieldCheck, ShoppingCart, UserCircle } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getCurrentUserRole } from '@/lib/admin';
import { getActiveCartItemCount } from '@/lib/cart';
import { getCartSessionId } from '@/lib/cart-session';
import { getCreditBalanceForDisplay } from '@/lib/credits';
import { getTranslations } from 'next-intl/server';
import { getRequestLocale } from '@/lib/i18n-server';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';

export async function MarketplaceHeader() {
  const supabase = await getServerSupabase();
  const locale = await getRequestLocale();
  const t = await getTranslations();
  const user = await getCurrentUser();
  const role = user ? await getCurrentUserRole() : null;
  const sessionId = user ? null : await getCartSessionId();
  const [creditBalance, cartCount] = user
    ? await Promise.all([
        getCreditBalanceForDisplay(supabase, user.id),
        getActiveCartItemCount(supabase, { userId: user.id }),
      ])
    : [0, sessionId ? await getActiveCartItemCount(getServiceSupabase(), { sessionId }) : 0];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 shadow-[0_1px_0_hsl(var(--cyber-cyan)/0.16)] backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container flex min-h-14 items-center justify-between gap-2 py-2">
        <nav className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link href="/" aria-label="Uniqraft home" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <BrandLogo />
          </Link>
          <Link href="/catalog" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
            {t('nav.catalog')}
          </Link>
        </nav>
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <CurrencySwitcher />
          <LanguageSwitcher activeLocale={locale} />
          <ThemeToggle />
          {user ? (
            <>
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link href="/credits">
                  <Coins className="mr-1 h-4 w-4" />
                  {creditBalance}
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/cart">
                  <ShoppingCart className="mr-1 h-4 w-4" />
                  {cartCount}
                </Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-1 h-4 w-4" />
                  {t('nav.dashboard')}
                </Link>
              </Button>
              {role === 'admin' && (
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/admin">
                    <ShieldCheck className="mr-1 h-4 w-4" />
                    {t('nav.admin')}
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="icon">
                <Link href="/profile" aria-label={t('nav.profile')}>
                    <UserCircle className="h-4 w-4" />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/cart">
                  <ShoppingCart className="mr-1 h-4 w-4" />
                  {cartCount}
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t('auth.login')}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/register">{t('auth.signup')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
