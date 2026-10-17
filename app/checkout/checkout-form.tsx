'use client';

import { type ComponentProps, useActionState } from 'react';
import { createCheckoutOrderAction } from '@/app/checkout/actions';
import { CHECKOUT_FIELD_LIMITS, type CheckoutLimitedField } from '@/app/checkout/checkout-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorOf, idleState } from '@/lib/action-state';

export type CheckoutFormCopy = {
  summary: string;
  paymentNote: string;
  contactEmail: string;
  recipient: string;
  phone: string;
  address1: string;
  address2: string;
  country: string;
  city: string;
  region: string;
  postal: string;
  subtotal: string;
  shipping: string;
  total: string;
  resolveIssues: string;
  createOrder: string;
  creatingOrder: string;
};

export type CheckoutFormProps = {
  locale: string;
  defaultEmail: string;
  countryName: string;
  subtotalText: string;
  shippingText: string;
  totalText: string;
  hasIssues: boolean;
  canSubmit: boolean;
  copy: CheckoutFormCopy;
};

type FieldName = CheckoutLimitedField | 'contactEmail';

type CheckoutFieldProps = Omit<ComponentProps<typeof Input>, 'name' | 'id'> & {
  name: FieldName;
  label: string;
  error?: string;
};

function CheckoutField({ name, label, error, ...inputProps }: CheckoutFieldProps) {
  const limits = name === 'contactEmail' ? undefined : CHECKOUT_FIELD_LIMITS[name];
  const errorId = `${name}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        minLength={limits && limits.min > 0 ? limits.min : undefined}
        maxLength={limits?.max}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CheckoutForm({
  locale,
  defaultEmail,
  countryName,
  subtotalText,
  shippingText,
  totalText,
  hasIssues,
  canSubmit,
  copy,
}: CheckoutFormProps) {
  const [state, action, pending] = useActionState(createCheckoutOrderAction, idleState);
  const formError = errorOf(state);
  const fieldErrors = state.status === 'error' ? (state.fieldErrors ?? {}) : {};
  // React resets a form once its action settles; echoing the submitted values
  // back as defaultValue keeps what the buyer typed while they fix one field.
  const values = state.status === 'error' ? (state.values ?? {}) : {};
  const errorFor = (name: FieldName) => fieldErrors[name]?.[0];

  return (
    <form action={action} className="space-y-4 rounded-lg border p-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="countryCode" value="AM" />
      <div>
        <h2 className="font-semibold">{copy.summary}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.paymentNote}</p>
      </div>
      {formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <CheckoutField
        name="contactEmail"
        label={copy.contactEmail}
        type="email"
        autoComplete="email"
        defaultValue={values.contactEmail ?? defaultEmail}
        error={errorFor('contactEmail')}
        required
      />
      <CheckoutField
        name="recipientName"
        label={copy.recipient}
        autoComplete="name"
        defaultValue={values.recipientName ?? ''}
        error={errorFor('recipientName')}
        required
      />
      <CheckoutField
        name="phone"
        label={copy.phone}
        type="tel"
        autoComplete="tel"
        defaultValue={values.phone ?? ''}
        error={errorFor('phone')}
        required
      />
      <CheckoutField
        name="addressLine1"
        label={copy.address1}
        autoComplete="address-line1"
        defaultValue={values.addressLine1 ?? ''}
        error={errorFor('addressLine1')}
        required
      />
      <CheckoutField
        name="addressLine2"
        label={copy.address2}
        autoComplete="address-line2"
        defaultValue={values.addressLine2 ?? ''}
        error={errorFor('addressLine2')}
      />
      <div className="space-y-2">
        <Label htmlFor="countryDisplay">{copy.country}</Label>
        <Input id="countryDisplay" value={countryName} disabled readOnly />
      </div>
      <CheckoutField
        name="city"
        label={copy.city}
        autoComplete="address-level2"
        defaultValue={values.city ?? ''}
        error={errorFor('city')}
        required
      />
      <CheckoutField
        name="administrativeArea"
        label={copy.region}
        autoComplete="address-level1"
        defaultValue={values.administrativeArea ?? ''}
        error={errorFor('administrativeArea')}
      />
      <CheckoutField
        name="postalCode"
        label={copy.postal}
        autoComplete="postal-code"
        defaultValue={values.postalCode ?? ''}
        error={errorFor('postalCode')}
      />
      <div className="flex justify-between border-t pt-4">
        <span className="text-muted-foreground">{copy.subtotal}</span>
        <span className="font-semibold">{subtotalText}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{copy.shipping}</span>
        <span className="font-semibold">{shippingText}</span>
      </div>
      <div className="flex justify-between border-t pt-4 text-lg">
        <span>{copy.total}</span>
        <span className="font-bold">{totalText}</span>
      </div>
      {hasIssues ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {copy.resolveIssues}
        </div>
      ) : null}
      <Button type="submit" className="w-full" disabled={!canSubmit || pending}>
        {pending ? copy.creatingOrder : copy.createOrder}
      </Button>
    </form>
  );
}
