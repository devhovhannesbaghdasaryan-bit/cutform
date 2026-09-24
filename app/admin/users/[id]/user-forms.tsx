'use client';

import { useActionState } from 'react';
import {
  adjustAdminUserCreditsAction,
  updateAdminUserProfileAction,
} from '@/app/admin/users/actions';
import { Button } from '@/components/ui/button';
import { errorOf, idleState, type ActionState } from '@/lib/action-state';

function StatusMessage({ state }: { state: ActionState<null> }) {
  const error = errorOf(state);
  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (state.status === 'success' && state.message) {
    return <p className="text-sm text-muted-foreground">{state.message}</p>;
  }
  return null;
}

export function UserProfileForm({
  userId,
  role,
  status,
  preferredLocale,
  internalNotes,
}: {
  userId: string;
  role: string;
  status: string;
  preferredLocale: string | null;
  internalNotes: string | null;
}) {
  const [state, action, pending] = useActionState(updateAdminUserProfileAction, idleState);

  return (
    <form action={action} className="mt-4 grid gap-4 md:grid-cols-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="space-y-2 text-sm">
        <span className="font-medium">Role</span>
        <select
          name="role"
          defaultValue={role}
          className="h-10 w-full rounded-md border border-input bg-background px-3"
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label className="space-y-2 text-sm">
        <span className="font-medium">Status</span>
        <select
          name="status"
          defaultValue={status}
          className="h-10 w-full rounded-md border border-input bg-background px-3"
        >
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="disabled">Disabled</option>
        </select>
      </label>
      <label className="space-y-2 text-sm">
        <span className="font-medium">Preferred locale</span>
        <select
          name="preferredLocale"
          defaultValue={preferredLocale ?? ''}
          className="h-10 w-full rounded-md border border-input bg-background px-3"
        >
          <option value="">Auto</option>
          <option value="en">English</option>
          <option value="ru">Russian</option>
          <option value="am">Armenian</option>
        </select>
      </label>
      <label className="space-y-2 text-sm md:col-span-2">
        <span className="font-medium">Internal notes</span>
        <textarea
          name="internalNotes"
          defaultValue={internalNotes ?? ''}
          className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <div className="space-y-2 md:col-span-2">
        <StatusMessage state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : 'Save user changes'}
        </Button>
      </div>
    </form>
  );
}

export function CreditAdjustmentForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(adjustAdminUserCreditsAction, idleState);

  return (
    <form action={action} className="space-y-4 rounded-lg border p-5">
      <input type="hidden" name="userId" value={userId} />
      <h2 className="font-semibold">Manual credit adjustment</h2>
      <div>
        <select
          name="direction"
          defaultValue="credit"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
      </div>
      <div>
        <input
          name="amount"
          type="number"
          min="1"
          step="1"
          required
          placeholder="Amount"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
      <textarea
        name="reason"
        required
        minLength={3}
        placeholder="Reason (at least 3 characters)"
        className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <StatusMessage state={state} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? 'Applying...' : 'Apply adjustment'}
      </Button>
    </form>
  );
}
