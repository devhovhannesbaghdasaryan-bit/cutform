'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { updateOrderStatusAction } from '@/app/admin/orders/[id]/actions';
import { errorOf, idleState } from '@/lib/action-state';

const PRODUCTION_STATUSES = [
  'draft',
  'pending_payment',
  'paid',
  'review_required',
  'approved_for_production',
  'in_production',
  'ready_to_ship',
  'shipped',
  'cancelled',
  'refunded',
] as const;

const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded', 'failed'] as const;

export function OrderStatusForm({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(updateOrderStatusAction, idleState);
  const error = errorOf(state);

  return (
    <form action={action} className="space-y-4 rounded-lg border p-5">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">{t('adminOrders.statusForm.productionStatus')}</Label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {PRODUCTION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="paymentStatus">{t('adminOrders.statusForm.paymentStatus')}</Label>
          <select
            id="paymentStatus"
            name="paymentStatus"
            defaultValue={paymentStatus}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {PAYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`adminOrders.paymentStatus.${value}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t('adminOrders.statusForm.updating') : t('adminOrders.statusForm.submit')}
      </Button>
    </form>
  );
}
