import Link from 'next/link';
import { Minus, ShoppingCart, Trash2 } from 'lucide-react';
import {
  clearCartAction,
  removeCartItemAction,
  updateCartQuantityAction,
} from '@/app/cart/actions';
import { MarketplaceHeader } from '@/components/marketplace-header';
import { Button } from '@/components/ui/button';
import { listSessionCartItems, listUserCartItems, validateCartBeforeCheckout } from '@/lib/cart';
import { getCartSessionId } from '@/lib/cart-session';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sessionId = user ? null : await getCartSessionId();
  const cartData = user
    ? await listUserCartItems(supabase, user.id)
    : sessionId
      ? await listSessionCartItems(getServiceSupabase(), sessionId)
      : { cart: null, items: [] };
  const items = cartData.items;
  const issues = user
    ? await validateCartBeforeCheckout(supabase, user.id).catch(() => [])
    : [];
  const issueByItem = new Map(issues.map((issue) => [issue.cartItemId, issue]));
  const subtotal = items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
  const subtotalCurrency = items[0]?.currency ?? cartData.cart?.currency ?? 'AMD';

  return (
    <>
      <MarketplaceHeader />
      <main className="container max-w-6xl space-y-8 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">Shopping cart</h1>
            <p className="max-w-2xl text-muted-foreground">Review items before checkout. Shipping and tax are calculated later.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!user && (
              <Button asChild>
                <Link href="/login?next=/cart">Log in to checkout</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/catalog">Continue shopping</Link>
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Your cart is empty</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Add catalog or generated items to start an order.</p>
            <Button asChild className="mt-5">
              <Link href="/catalog">Browse catalog</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <section className="overflow-hidden rounded-lg border">
              <div className="divide-y">
                {items.map((item) => {
                  const issue = issueByItem.get(item.id);
                  const isGenerated = Boolean(item.generated_item_id);
                  return (
                    <div key={item.id} className="grid gap-4 p-4 sm:grid-cols-[96px_1fr_auto]">
                      <div className="flex aspect-square items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                        Preview
                      </div>
                      <div className="min-w-0 space-y-2">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {isGenerated ? 'Generated item' : 'Catalog item'}
                        </p>
                        {issue && (
                          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {issue.message}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <form action={updateCartQuantityAction} className="flex items-center gap-2">
                            <input type="hidden" name="cartItemId" value={item.id} />
                            <input
                              name="quantity"
                              type="number"
                              min="1"
                              max={isGenerated ? 1 : 99}
                              defaultValue={item.quantity}
                              disabled={isGenerated}
                              className="h-9 w-20 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                            />
                            <Button type="submit" variant="outline" size="sm" disabled={isGenerated}>
                              Update
                            </Button>
                          </form>
                          <form action={removeCartItemAction}>
                            <input type="hidden" name="cartItemId" value={item.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              <Trash2 className="mr-1 h-4 w-4" />
                              Remove
                            </Button>
                          </form>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatPrice(item.unit_price_cents * item.quantity, item.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(item.unit_price_cents, item.currency)} each
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-lg border p-5">
                <h2 className="font-semibold">Summary</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-medium">{formatPrice(subtotal, subtotalCurrency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Shipping</dt>
                    <dd>Later</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tax</dt>
                    <dd>Later</dd>
                  </div>
                </dl>
                {!user ? (
                  <Button asChild className="mt-5 w-full">
                    <Link href="/login?next=/checkout">Log in to checkout</Link>
                  </Button>
                ) : issues.length > 0 ? (
                  <Button className="mt-5 w-full" disabled>
                    Checkout review
                  </Button>
                ) : (
                  <Button asChild className="mt-5 w-full">
                    <Link href="/checkout">Checkout review</Link>
                  </Button>
                )}
                {issues.length > 0 && (
                  <p className="mt-2 text-sm text-destructive">
                    Resolve cart item messages before checkout.
                  </p>
                )}
              </div>

              <form action={clearCartAction}>
                <Button type="submit" variant="outline" className="w-full">
                  <Minus className="mr-2 h-4 w-4" />
                  Clear cart
                </Button>
              </form>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
