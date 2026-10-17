// Length limits shared by the checkout server action (zod schema) and the
// client form (HTML minLength/maxLength), so the browser blocks the same
// inputs the server rejects and the two never drift apart.
export const CHECKOUT_FIELD_LIMITS = {
  recipientName: { min: 2, max: 120 },
  phone: { min: 5, max: 40 },
  addressLine1: { min: 3, max: 160 },
  addressLine2: { min: 0, max: 160 },
  city: { min: 2, max: 100 },
  administrativeArea: { min: 0, max: 100 },
  postalCode: { min: 0, max: 30 },
} as const;

export type CheckoutLimitedField = keyof typeof CHECKOUT_FIELD_LIMITS;
