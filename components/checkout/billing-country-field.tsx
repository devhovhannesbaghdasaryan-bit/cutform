'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function BillingCountryField({
  countries,
  defaultCountry,
  polarEnabled,
  baseDisabled,
  billingLabel,
  unavailableLabel,
  submitLabel,
}: {
  countries: { code: string; label: string }[];
  defaultCountry: string;
  polarEnabled: boolean;
  baseDisabled: boolean;
  billingLabel: string;
  unavailableLabel: string;
  submitLabel: string;
}) {
  const [country, setCountry] = useState(defaultCountry);
  const blocked = !polarEnabled && country !== 'AM';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="billingCountryCode">{billingLabel}</Label>
        <select
          id="billingCountryCode"
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
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {unavailableLabel}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={baseDisabled || blocked}>
        {submitLabel}
      </Button>
    </div>
  );
}
