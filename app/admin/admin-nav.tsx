import Link from 'next/link';
import { Banknote, Boxes, ClipboardList, CreditCard, Globe2, LayoutDashboard, SlidersHorizontal, Sparkles, Store, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const links = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/create', label: 'Create', icon: Sparkles },
  { href: '/admin/items', label: 'Items', icon: Boxes },
  { href: '/personalization', label: 'Personalization', icon: SlidersHorizontal },
  { href: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/transactions', label: 'Transactions', icon: CreditCard },
  { href: '/admin/currencies', label: 'Currencies', icon: Banknote },
  { href: '/admin/markets', label: 'Markets', icon: Globe2 },
  { href: '/catalog', label: 'Storefront', icon: Store },
];

export function AdminNav() {
  return (
    <nav className="border-b bg-muted/30">
      <div className="container flex gap-2 overflow-x-auto py-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Button key={link.href} asChild variant="ghost" size="sm" className="shrink-0">
              <Link href={link.href}>
                <Icon className="mr-2 h-4 w-4" />
                {link.label}
              </Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
