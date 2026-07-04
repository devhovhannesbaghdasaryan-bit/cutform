import Link from 'next/link';
import { Coins, LayoutDashboard, ShieldCheck, ShoppingCart, UserCircle } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getCurrentUserRole } from '@/lib/admin';
import { getCartSessionId } from '@/lib/cart-session';
import { translate } from '@/lib/i18n';
import { getRequestLocale } from '@/lib/i18n-server';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';

export async function MarketplaceHeader() {
  const supabase = await getServerSupabase();
  const locale = await getRequestLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user ? await getCurrentUserRole() : null;
  const sessionId = user ? null : await getCartSessionId();
  const [{ data: creditAccount }, { data: cart }] = user
    ? await Promise.all([
        supabase
          .from('credit_accounts')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle<{ balance: number }>(),
        supabase
          .from('carts')
          .select('id, cart_items(id)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle<{ id: string; cart_items: { id: string }[] }>(),
      ])
    : [
        { data: null },
        sessionId
          ? await getServiceSupabase()
              .from('carts')
              .select('id, cart_items(id)')
              .eq('session_id', sessionId)
              .eq('status', 'active')
              .maybeSingle<{ id: string; cart_items: { id: string }[] }>()
          : { data: null },
      ];
  const cartCount = cart?.cart_items?.length ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 shadow-[0_1px_0_hsl(var(--cyber-cyan)/0.16)] backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container flex min-h-14 items-center justify-between gap-2 py-2">
        <nav className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link href="/" aria-label="Uniqraft home" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <BrandLogo />
          </Link>
          <Link href="/catalog" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
            {translate(locale, 'nav.catalog')}
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
                  {creditAccount?.balance ?? 0}
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
                  {translate(locale, 'nav.dashboard')}
                </Link>
              </Button>
              {role === 'admin' && (
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/admin">
                    <ShieldCheck className="mr-1 h-4 w-4" />
                    {translate(locale, 'nav.admin')}
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="icon">
                <Link href="/profile" aria-label={translate(locale, 'nav.profile')}>
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
                <Link href="/login">{translate(locale, 'auth.login')}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/register">{translate(locale, 'auth.signup')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
