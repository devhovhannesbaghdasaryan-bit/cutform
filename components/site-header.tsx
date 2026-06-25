import Link from 'next/link';
import { Coins, Plus, ShieldCheck, ShoppingCart, Store } from 'lucide-react';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LogoutMenuItem } from '@/components/logout-menu-item';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCurrentUserRole } from '@/lib/admin';
import { getRequestLocale } from '@/lib/i18n-server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function SiteHeader({ email, hideCreate }: { email: string; hideCreate?: boolean }) {
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
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Snip
        </Link>
        <div className="flex items-center gap-2">
          <CurrencySwitcher />
          <LanguageSwitcher activeLocale={locale} />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/catalog">
              <Store className="mr-1 h-4 w-4" /> Catalog
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
                <ShieldCheck className="mr-1 h-4 w-4" /> Admin
              </Link>
            </Button>
          )}
          {!hideCreate && (
            <Button asChild size="sm">
              <Link href="/create">
                <Plus className="mr-1 h-4 w-4" /> Create new
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
                Signed in
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <LogoutMenuItem />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
