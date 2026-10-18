import Link from 'next/link';
import {
  Banknote,
  Boxes,
  ClipboardList,
  CreditCard,
  Globe2,
  Images,
  LayoutDashboard,
  Plug,
  SlidersHorizontal,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

const links = [
  { href: '/admin', labelKey: 'adminNav.overview', icon: LayoutDashboard },
  { href: '/admin/create', labelKey: 'adminNav.create', icon: Sparkles },
  { href: '/admin/items', labelKey: 'adminNav.items', icon: Boxes },
  { href: '/admin/personalization', labelKey: 'adminNav.personalization', icon: SlidersHorizontal },
  { href: '/admin/generated', labelKey: 'adminNav.generations', icon: Images },
  { href: '/admin/orders', labelKey: 'adminNav.orders', icon: ClipboardList },
  { href: '/admin/users', labelKey: 'adminNav.users', icon: Users },
  { href: '/admin/transactions', labelKey: 'adminNav.transactions', icon: CreditCard },
  { href: '/admin/currencies', labelKey: 'adminNav.currencies', icon: Banknote },
  { href: '/admin/markets', labelKey: 'adminNav.markets', icon: Globe2 },
  { href: '/admin/connectors', labelKey: 'adminNav.connectors', icon: Plug },
  { href: '/catalog', labelKey: 'adminNav.storefront', icon: Store },
] as const;

export function AdminNav() {
  const t = useTranslations();
  return (
    <nav aria-label={t('adminNav.ariaLabel')} className="border-b bg-muted/30">
      <div className="container flex gap-2 overflow-x-auto py-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Button key={link.href} asChild variant="ghost" size="sm" className="shrink-0">
              <Link href={link.href}>
                <Icon className="mr-2 h-4 w-4" />
                {t(link.labelKey)}
              </Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
