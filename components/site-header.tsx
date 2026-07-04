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
import { translate } from '@/lib/i18n';
import { getRequestLocale } from '@/lib/i18n-server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function SiteHeader({ email }: { email: string }) {
  const supabase = await getServerSupabase();
  const locale = await getRequestLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = await getCurrentUserRole();
  const isAdmin = role === 'admin';
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
    : [{ data: null }, { data: null }];
  const cartCount = cart?.cart_items?.length ?? 0;

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-4">
        <Link href="/" aria-label={translate(locale, 'nav.home')} className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-2">
          <CurrencySwitcher />
          <LanguageSwitcher activeLocale={locale} />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/catalog">
              <Store className="mr-1 h-4 w-4" /> {translate(locale, 'nav.catalog')}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/credits">
              <Coins className="mr-1 h-4 w-4" /> {creditAccount?.balance ?? 0}
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
                <ShieldCheck className="mr-1 h-4 w-4" /> {translate(locale, 'nav.admin')}
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
                {translate(locale, 'auth.signedIn')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserCircle className="mr-2 h-4 w-4" />
                  {translate(locale, 'nav.profile')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <LogoutMenuItem label={translate(locale, 'auth.logout')} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
