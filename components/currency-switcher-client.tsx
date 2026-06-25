'use client';

import { useRef } from 'react';
import { setCurrencyPreferenceAction } from '@/app/currency/actions';
import type { AppCurrency } from '@/lib/currency';

export function CurrencySwitcherClient({
  activeCurrency,
  currencies,
}: {
  activeCurrency: AppCurrency;
  currencies: { code: AppCurrency }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setCurrencyPreferenceAction} aria-label="Currency">
      <select
        name="currency"
        defaultValue={activeCurrency}
        className="h-8 rounded-md border bg-background px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        onChange={() => formRef.current?.requestSubmit()}
      >
        {currencies.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {currency.code}
          </option>
        ))}
      </select>
    </form>
  );
}
