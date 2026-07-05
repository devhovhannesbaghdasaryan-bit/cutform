import Link from 'next/link';
import { CalendarDays, Coins, Languages, LayoutDashboard, Mail, ShieldCheck, UserCircle } from 'lucide-react';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { formatLocalizedDate, translate, translateWithFallback } from '@/lib/i18n';
import { getRequestLocale } from '@/lib/i18n-server';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [supabase, locale] = await Promise.all([getServerSupabase(), getRequestLocale()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/profile');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role, status, preferred_locale, preferred_currency, created_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const displayName = profile?.display_name
    ?? user.user_metadata?.display_name
    ?? user.email?.split('@')[0]
    ?? translate(locale, 'profile.memberFallback');
  const preferredLanguage = profile?.preferred_locale
    ? translateWithFallback(locale, `profile.language.${profile.preferred_locale}`, profile.preferred_locale.toUpperCase())
    : translate(locale, 'profile.notSelected');
  const memberSince = formatLocalizedDate(locale, profile?.created_at ?? user.created_at);
  const accountStatus = profile?.status ?? 'active';
  const accountRole = profile?.role ?? 'user';

  return (
    <>
      <SiteHeader email={user.email ?? ''} />
      <main className="container space-y-8 py-10">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border bg-secondary text-secondary-foreground shadow-sm">
              <UserCircle className="h-9 w-9" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{translate(locale, 'profile.yourAccount')}</p>
              <h1 className="truncate text-3xl font-bold tracking-tight">{displayName}</h1>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              {translate(locale, 'profile.yourProducts')}
            </Link>
          </Button>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={translate(locale, 'profile.details')}>
          <ProfileDetail icon={Mail} label={translate(locale, 'profile.email')} value={user.email ?? translate(locale, 'profile.notAvailable')} />
          <ProfileDetail
            icon={ShieldCheck}
            label={translate(locale, 'profile.accountStatus')}
            value={translateWithFallback(locale, `profile.status.${accountStatus}`, accountStatus)}
          />
          <ProfileDetail
            icon={CalendarDays}
            label={translate(locale, 'profile.memberSince')}
            value={memberSince}
          />
          <ProfileDetail icon={Languages} label={translate(locale, 'profile.preferredLanguage')} value={preferredLanguage} />
          <ProfileDetail icon={Coins} label={translate(locale, 'profile.preferredCurrency')} value={profile?.preferred_currency ?? translate(locale, 'profile.notSelected')} />
          <ProfileDetail icon={ShieldCheck} label={translate(locale, 'profile.accountType')} value={translateWithFallback(locale, `profile.role.${accountRole}`, accountRole)} />
        </section>

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{translate(locale, 'profile.shortcuts')}</h2>
            <p className="text-sm text-muted-foreground">{translate(locale, 'profile.shortcutsHelp')}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild><Link href="/dashboard">{translate(locale, 'profile.yourProducts')}</Link></Button>
            <Button asChild variant="outline"><Link href="/credits">{translate(locale, 'profile.credits')}</Link></Button>
            <Button asChild variant="outline"><Link href="/cart">{translate(locale, 'profile.cart')}</Link></Button>
            <Button asChild variant="outline"><Link href="/catalog">{translate(locale, 'profile.browseCatalog')}</Link></Button>
          </div>
        </section>
      </main>
    </>
  );
}

function ProfileDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserCircle;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}
