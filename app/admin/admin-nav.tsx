'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  Boxes,
  ClipboardList,
  CreditCard,
  ExternalLink,
  Globe2,
  Images,
  LayoutDashboard,
  Plug,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type NavLink = {
  href: string;
  labelKey:
    | 'adminNav.overview'
    | 'adminNav.items'
    | 'adminNav.personalization'
    | 'adminNav.generations'
    | 'adminNav.orders'
    | 'adminNav.users'
    | 'adminNav.transactions'
    | 'adminNav.currencies'
    | 'adminNav.markets'
    | 'adminNav.connectors';
  icon: typeof Boxes;
  count?: 'review' | 'orders';
};

type NavGroup = {
  labelKey:
    | 'adminNav.groupCatalog'
    | 'adminNav.groupProduction'
    | 'adminNav.groupCustomers'
    | 'adminNav.groupSettings';
  links: NavLink[];
};

const GROUPS: NavGroup[] = [
  {
    labelKey: 'adminNav.groupCatalog',
    links: [
      { href: '/admin/items', labelKey: 'adminNav.items', icon: Boxes },
      {
        href: '/admin/personalization',
        labelKey: 'adminNav.personalization',
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    labelKey: 'adminNav.groupProduction',
    links: [
      { href: '/admin/generated', labelKey: 'adminNav.generations', icon: Images, count: 'review' },
      { href: '/admin/orders', labelKey: 'adminNav.orders', icon: ClipboardList, count: 'orders' },
    ],
  },
  {
    labelKey: 'adminNav.groupCustomers',
    links: [
      { href: '/admin/users', labelKey: 'adminNav.users', icon: Users },
      { href: '/admin/transactions', labelKey: 'adminNav.transactions', icon: CreditCard },
    ],
  },
  {
    labelKey: 'adminNav.groupSettings',
    links: [
      { href: '/admin/currencies', labelKey: 'adminNav.currencies', icon: Banknote },
      { href: '/admin/markets', labelKey: 'adminNav.markets', icon: Globe2 },
      { href: '/admin/connectors', labelKey: 'adminNav.connectors', icon: Plug },
    ],
  },
];

/**
 * Dark grouped sidebar for the admin shell. Stacks above the content below the
 * `lg` breakpoint. Counts come from the layout so the nav stays presentational.
 */
export function AdminNav({
  reviewCount,
  openOrderCount,
  email,
}: {
  reviewCount: number;
  openOrderCount: number;
  email: string;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/admin'
      ? pathname === '/admin'
      : pathname === href || pathname.startsWith(`${href}/`);

  const renderLink = (link: NavLink) => {
    const Icon = link.icon;
    const active = isActive(link.href);
    const count =
      link.count === 'review' ? reviewCount : link.count === 'orders' ? openOrderCount : 0;
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-[38px] items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold text-[#C9CED8] transition-colors hover:bg-white/[0.07] hover:text-white',
          active &&
            'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
        )}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="truncate">{t(link.labelKey)}</span>
        {count > 0 ? (
          <span
            className={cn(
              'ml-auto grid h-5 min-w-[22px] place-items-center rounded-full px-1.5 text-[11.5px] font-extrabold',
              link.count === 'review' ? 'bg-gold text-gold-foreground' : 'bg-white/15 text-white',
            )}
          >
            {count}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside className="flex min-w-0 flex-[1_1_220px] flex-col bg-slate px-3.5 py-[18px] text-[#C9CED8] lg:max-w-[248px] lg:min-h-screen">
      <Link href="/admin" className="flex items-center gap-2.5 px-2.5 pb-[18px] pt-1 text-white">
        <Image
          src="/brand/uniqraft-mark.png?v=20260704"
          alt=""
          width={30}
          height={30}
          unoptimized
          className="size-[30px] rounded-[7px]"
        />
        <span className="font-display text-base font-bold">Uniqraft</span>
        <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
          {t('adminNav.badge')}
        </span>
      </Link>
      <nav aria-label={t('adminNav.ariaLabel')} className="flex flex-col gap-0.5">
        {renderLink({ href: '/admin', labelKey: 'adminNav.overview', icon: LayoutDashboard })}
        {GROUPS.map((group) => (
          <div key={group.labelKey} className="contents">
            <p className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-extrabold uppercase tracking-wider text-[#7C8494]">
              {t(group.labelKey)}
            </p>
            {group.links.map(renderLink)}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2 pt-[18px]">
        <Link
          href="/"
          className="flex h-[38px] items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold text-[#C9CED8] transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <ExternalLink className="size-[18px]" aria-hidden="true" />
          {t('adminNav.storefront')}
        </Link>
        <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.06] px-2.5 py-2">
          <span
            aria-hidden="true"
            className="grid size-[30px] shrink-0 place-items-center rounded-full bg-[#0797A0] text-xs font-extrabold text-white"
          >
            {email.slice(0, 2).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[13px] font-bold text-white">{email}</span>
            <span className="text-[11.5px] text-[#7C8494]">{t('adminNav.signedInAs')}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
