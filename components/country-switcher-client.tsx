'use client';

import { useRef } from 'react';
import { setCountryPreferenceAction } from '@/app/country/actions';

export function CountrySwitcherClient({
  activeCountry,
  countries,
  placeholder,
  label,
}: {
  activeCountry: string;
  countries: { code: string; label: string }[];
  /** Localized "Country" placeholder option (nav.country). */
  placeholder: string;
  /** Localized form label (nav.shippingCountry). */
  label: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setCountryPreferenceAction} aria-label={label}>
      <select
        name="country"
        defaultValue={activeCountry}
        className="h-8 max-w-32 rounded-md border bg-background px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {countries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.label}
          </option>
        ))}
      </select>
    </form>
  );
}
