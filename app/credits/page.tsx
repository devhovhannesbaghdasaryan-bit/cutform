import { redirect } from 'next/navigation';
import { Coins } from 'lucide-react';
import { createCreditPackCheckoutAction } from '@/app/credits/actions';
import { SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { CREDIT_PACKS } from '@/lib/credit-packs';
import { convertMoney, getActiveCurrency, normalizeCurrency } from '@/lib/currency';
import { formatLocalizedCurrency, formatLocalizedDate, translate } from '@/lib/i18n';
import { getRequestLocale } from '@/lib/i18n-server';
import { getPaymentRoute } from '@/lib/payments/router';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CreditsPage() {
  const [supabase, locale] = await Promise.all([getServerSupabase(), getRequestLocale()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: account } = await supabase
    .from('credit_accounts')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle<{ balance: number }>();
  const { data: ledger } = await supabase
    .from('credit_ledger')
    .select('id, delta, reason, reference_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
    .returns<
      {
        id: string;
        delta: number;
        reason: string;
        reference_type: string | null;
        created_at: string;
      }[]
    >();
  const { data: pendingRequests } = await supabase
    .from('transactions')
    .select('id, amount_cents, currency, metadata, created_at')
    .eq('user_id', user.id)
    .eq('type', 'credit_purchase')
    .eq('status', 'pending')
    .in('provider', ['manual', 'bank_manual'])
    .order('created_at', { ascending: false })
    .limit(5)
    .returns<
      {
        id: string;
        amount_cents: number;
        currency: string;
        metadata: Record<string, unknown>;
        created_at: string;
      }[]
    >();
  const activeCurrency = await getActiveCurrency();
  const displayPacks = await Promise.all(
    CREDIT_PACKS.map(async (pack) => {
      const converted = await convertMoney(
        pack.priceCents,
        normalizeCurrency(pack.currency) ?? 'AMD',
        activeCurrency,
      );
      const paymentRoute = await getPaymentRoute(converted.currency);
      return {
        ...pack,
        displayPriceCents: converted.amountCents,
        displayCurrency: converted.currency,
        paymentRoute,
      };
    }),
  );

  return (
    <>
      <SiteHeader email={user.email ?? ''} />
      <main className="container max-w-3xl space-y-6 py-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{translate(locale, 'credits.title')}</h1>
          <p className="text-muted-foreground">
            {translate(locale, 'credits.subtitle')}
          </p>
        </div>

        <section className="rounded-lg border p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-secondary p-3">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{translate(locale, 'credits.balance')}</p>
              <p className="text-3xl font-bold">{account?.balance ?? 0} {translate(locale, 'credits.unit')}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border">
          <div className="border-b p-4">
            <h2 className="font-semibold">{translate(locale, 'credits.activity')}</h2>
          </div>
          {!ledger?.length ? (
            <p className="p-4 text-sm text-muted-foreground">{translate(locale, 'credits.noActivity')}</p>
          ) : (
            <div className="divide-y">
              {ledger.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-4 p-4 text-sm">
                  <div>
                    <p className="font-medium">{entry.reason}</p>
                    <p className="text-xs text-muted-foreground">{entry.reference_type ?? translate(locale, 'credits.noReference')}</p>
                  </div>
                  <div className="text-right">
                    <p className={entry.delta >= 0 ? 'font-semibold text-success' : 'font-semibold text-destructive'}>
                      {entry.delta >= 0 ? '+' : ''}{entry.delta}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatLocalizedDate(locale, entry.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-lg border p-6">
          <div>
            <h2 className="font-semibold">{translate(locale, 'credits.packs')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {translate(locale, 'credits.packsHelp')}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {displayPacks.map((pack) => (
              <form key={pack.key} action={createCreditPackCheckoutAction} className="space-y-4 rounded-md border p-4">
                <input type="hidden" name="packKey" value={pack.key} />
                <div>
                  <h3 className="font-medium">{pack.name}</h3>
                  <p className="text-2xl font-bold">{pack.creditAmount} {translate(locale, 'credits.unit')}</p>
                  <p className="text-sm text-muted-foreground">{formatLocalizedCurrency(locale, pack.displayPriceCents, pack.displayCurrency)}</p>
                  <p className="text-xs text-muted-foreground">
                    {pack.paymentRoute === 'ameria' ? translate(locale, 'credits.ameria') : translate(locale, 'credits.manual')}
                  </p>
                </div>
                <p className="min-h-10 text-xs text-muted-foreground">{pack.description}</p>
                <Button type="submit" className="w-full">
                  {translate(locale, 'credits.buy')}
                </Button>
              </form>
            ))}
          </div>
          {pendingRequests?.length ? (
            <div className="rounded-md border bg-muted/30 p-4">
              <h3 className="text-sm font-medium">{translate(locale, 'credits.pending')}</h3>
              <div className="mt-3 space-y-2">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="flex justify-between gap-4 text-sm">
                    <span>
                      {String(request.metadata.packName ?? translate(locale, 'credits.packFallback'))} - {String(request.metadata.creditAmount ?? '?')} {translate(locale, 'credits.unit')}
                    </span>
                    <span className="text-muted-foreground">{formatLocalizedDate(locale, request.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
