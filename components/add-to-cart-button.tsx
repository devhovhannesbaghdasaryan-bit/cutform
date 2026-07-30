'use client';

import { useActionState, useEffect } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { addCatalogItemToCartAction } from '@/app/cart/actions';
import { Button } from '@/components/ui/button';
import { idleState } from '@/lib/action-state';

/**
 * Add-to-cart form with feedback tied to the server action's result: pending
 * spinner while submitting, sonner toast on success or failure. Messages are
 * localized server-side and arrive in the action state.
 */
export function AddToCartButton({
  itemId,
  ariaLabel,
  buttonText,
  size = 'sm',
  variant = 'outline',
  className,
}: {
  itemId: string;
  ariaLabel: string;
  buttonText?: string;
  size?: 'sm' | 'lg';
  variant?: 'outline' | 'default';
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(addCatalogItemToCartAction, idleState);

  useEffect(() => {
    if (state.status === 'success') {
      toast.success(state.message);
    } else if (state.status === 'error') {
      toast.error(state.error);
    }
  }, [state]);

  const icon = pending ? (
    <Loader2 className={buttonText ? 'mr-2 h-4 w-4 animate-spin' : 'h-4 w-4 animate-spin'} />
  ) : (
    <ShoppingCart className={buttonText ? 'mr-2 h-4 w-4' : 'h-4 w-4'} />
  );

  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="itemId" value={itemId} />
      <Button
        type="submit"
        size={size}
        variant={variant}
        className={className}
        disabled={pending}
        aria-label={ariaLabel}
      >
        {icon}
        {buttonText}
      </Button>
    </form>
  );
}
