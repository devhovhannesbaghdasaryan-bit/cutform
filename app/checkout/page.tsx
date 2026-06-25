import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createCheckoutOrderAction } from '@/app/checkout/actions';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listUserCartItems, validateCartBeforeCheckout } from '@/lib/cart';
import { getRequestLocale } from '@/lib/i18n-server';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/checkout');

  const locale = await getRequestLocale();
  const [{ items }, issues] = await Promise.all([
    listUserCartItems(supabase, user.id),
    validateCartBeforeCheckout(supabase, user.id).catch(() => []),
  ]);

  if (!items.length) redirect('/cart');

  const issueByItem = new Map(issues.map((issue) => [issue.cartItemId, issue]));
  const subtotal = items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
  const subtotalCurrency = items[0]?.currency ?? 'AMD';

  return (
    <>
      <MarketplaceHeader />
      <main className="container max-w-5xl space-y-8 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Checkout review</h1>
            <p className="text-muted-foreground">
              Confirm the saved cart snapshot before creating an order.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/cart">Back to cart</Link>
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <section className="rounded-lg border">
            <div className="border-b p-4">
              <h2 className="font-semibold">Order items</h2>
            </div>
            <div className="divide-y">
              {items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty {item.quantity} &middot; {item.generated_item_id ? 'Generated item' : 'Catalog item'}
                    </p>
                    {issueByItem.get(item.id) ? (
                      <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {issueByItem.get(item.id)?.message}
                      </p>
                    ) : null}
                  </div>
                  <p className="font-medium">
                    {formatPrice(item.unit_price_cents * item.quantity, item.currency)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <form action={createCheckoutOrderAction} className="space-y-4 rounded-lg border p-5">
              <input type="hidden" name="locale" value={locale} />
              <div>
                <h2 className="font-semibold">Summary</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Payment provider checkout will attach to this order in the payment slice.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact email</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  defaultValue={user.email ?? ''}
                  required
                />
              </div>
              <div className="flex justify-between border-t pt-4">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatPrice(subtotal, subtotalCurrency)}</span>
              </div>
              {issues.length ? (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  Resolve cart issues before creating an order.
                </div>
              ) : null}
              <Button type="submit" className="w-full" disabled={issues.length > 0}>
                Create order
              </Button>
            </form>
          </aside>
        </div>
      </main>
    </>
  );
}
