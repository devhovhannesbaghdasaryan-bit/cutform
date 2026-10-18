'use client';

import { useTranslations } from 'next-intl';
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
  const t = useTranslations();
  const [state, action, pending] = useActionState(updateAdminUserProfileAction, idleState);

  return (
    <form action={action} className="mt-4 grid gap-4 md:grid-cols-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="space-y-2 text-sm">
        <span className="font-medium">{t('adminUsers.form.role')}</span>
        <select
          name="role"
          defaultValue={role}
          className="h-10 w-full rounded-md border border-input bg-background px-3"
        >
          <option value="user">{t('adminUsers.roles.user')}</option>
          <option value="admin">{t('adminUsers.roles.admin')}</option>
        </select>
      </label>
      <label className="space-y-2 text-sm">
        <span className="font-medium">{t('adminUsers.form.status')}</span>
        <select
          name="status"
          defaultValue={status}
          className="h-10 w-full rounded-md border border-input bg-background px-3"
        >
          <option value="active">{t('adminUsers.statuses.active')}</option>
          <option value="suspended">{t('adminUsers.statuses.suspended')}</option>
          <option value="disabled">{t('adminUsers.statuses.disabled')}</option>
        </select>
      </label>
      <label className="space-y-2 text-sm">
        <span className="font-medium">{t('adminUsers.form.preferredLocale')}</span>
        <select
          name="preferredLocale"
          defaultValue={preferredLocale ?? ''}
          className="h-10 w-full rounded-md border border-input bg-background px-3"
        >
          <option value="">{t('adminUsers.form.localeAuto')}</option>
          <option value="en">{t('adminUsers.form.localeEn')}</option>
          <option value="ru">{t('adminUsers.form.localeRu')}</option>
          <option value="am">{t('adminUsers.form.localeAm')}</option>
        </select>
      </label>
      <label className="space-y-2 text-sm md:col-span-2">
        <span className="font-medium">{t('adminUsers.form.internalNotes')}</span>
        <textarea
          name="internalNotes"
          defaultValue={internalNotes ?? ''}
          className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <div className="space-y-2 md:col-span-2">
        <StatusMessage state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? t('adminUsers.form.saving') : t('adminUsers.form.save')}
        </Button>
      </div>
    </form>
  );
}

export function CreditAdjustmentForm({ userId }: { userId: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(adjustAdminUserCreditsAction, idleState);

  return (
    <form action={action} className="space-y-4 rounded-lg border p-5">
      <input type="hidden" name="userId" value={userId} />
      <h2 className="font-semibold">{t('adminUsers.creditForm.title')}</h2>
      <div>
        <select
          name="direction"
          defaultValue="credit"
          aria-label={t('adminUsers.creditForm.direction')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="credit">{t('adminUsers.creditForm.credit')}</option>
          <option value="debit">{t('adminUsers.creditForm.debit')}</option>
        </select>
      </div>
      <div>
        <input
          name="amount"
          type="number"
          min="1"
          step="1"
          required
          placeholder={t('adminUsers.creditForm.amount')}
          aria-label={t('adminUsers.creditForm.amount')}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
      <textarea
        name="reason"
        required
        minLength={3}
        placeholder={t('adminUsers.creditForm.reason')}
        aria-label={t('adminUsers.creditForm.reason')}
        className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <StatusMessage state={state} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? t('adminUsers.creditForm.applying') : t('adminUsers.creditForm.apply')}
      </Button>
    </form>
  );
}
