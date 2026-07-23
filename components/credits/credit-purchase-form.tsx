'use client';

import type { ReactNode } from 'react';
import { createCreditPackCheckoutAction } from '@/app/credits/actions';
import { Button } from '@/components/ui/button';

export function CreditPurchaseForm({
  packKey,
  buyLabel,
  children,
}: {
  packKey: string;
  buyLabel: string;
  children: ReactNode;
}) {
  return (
    <form action={createCreditPackCheckoutAction} className="space-y-4 rounded-md border p-4">
      <input type="hidden" name="packKey" value={packKey} />
      {children}
      <Button type="submit" className="w-full">
        {buyLabel}
      </Button>
    </form>
  );
}
