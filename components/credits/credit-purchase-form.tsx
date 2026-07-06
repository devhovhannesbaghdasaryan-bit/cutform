'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { createCreditPackCheckoutAction } from '@/app/credits/actions';
import { Button } from '@/components/ui/button';

export function CreditPurchaseForm({
  packKey,
  countries,
  defaultCountry,
  polarEnabled,
  billingLabel,
  unavailableLabel,
  buyLabel,
  children,
}: {
  packKey: string;
  countries: { code: string; label: string }[];
  defaultCountry: string;
  polarEnabled: boolean;
  billingLabel: string;
  unavailableLabel: string;
  buyLabel: string;
  children: ReactNode;
}) {
  const [country, setCountry] = useState(defaultCountry);
  const blocked = !polarEnabled && country !== 'AM';

  return (
    <form action={createCreditPackCheckoutAction} className="space-y-4 rounded-md border p-4">
      <input type="hidden" name="packKey" value={packKey} />
      {children}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor={`billing-${packKey}`}>
          {billingLabel}
        </label>
        <select
          id={`billing-${packKey}`}
          name="billingCountryCode"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        >
          {countries.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {blocked ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {unavailableLabel}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={blocked}>
        {buyLabel}
      </Button>
    </form>
  );
}
