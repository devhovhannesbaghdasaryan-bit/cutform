import Link from 'next/link';
import { Coins, ShieldCheck, ShoppingCart, Store, UserCircle } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LogoutMenuItem } from '@/components/logout-menu-item';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCurrentUserRole } from '@/lib/admin';
import { getActiveCartItemCount } from '@/lib/cart';
import { getCreditBalanceForDisplay } from '@/lib/credits';
import { getTranslations } from 'next-intl/server';
import { getRequestLocale } from '@/lib/i18n-server';
import { getCurrentUser, getServerSupabase } from '@/lib/supabase/server';

export async function SiteHeader({ email }: { email: string }) {
  const supabase = await getServerSupabase();
  const locale = await getRequestLocale();
  const t = await getTranslations();
  const user = await getCurrentUser();
  const role = await getCurrentUserRole();
  const isAdmin = role === 'admin';
  const [creditBalance, cartCount] = user
    ? await Promise.all([
        getCreditBalanceForDisplay(supabase, user.id),
        getActiveCartItemCount(supabase, { userId: user.id }),
      ])
    : [0, 0];

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-4">
        <Link
          href="/"
          aria-label={t('nav.home')}
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-2">
          <CurrencySwitcher />
          <LanguageSwitcher activeLocale={locale} />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/catalog">
              <Store className="mr-1 h-4 w-4" /> {t('nav.catalog')}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/credits">
              <Coins className="mr-1 h-4 w-4" /> {creditBalance}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/cart">
              <ShoppingCart className="mr-1 h-4 w-4" /> {cartCount}
            </Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/admin">
                <ShieldCheck className="mr-1 h-4 w-4" /> {t('nav.admin')}
              </Link>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                {email}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                {t('auth.signedIn')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserCircle className="mr-2 h-4 w-4" />
                  {t('nav.profile')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <LogoutMenuItem label={t('auth.logout')} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
