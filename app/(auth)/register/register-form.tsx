'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerAction } from '@/app/(auth)/actions';
import { errorOf, idleState } from '@/lib/action-state';

export function RegisterForm({
  copy,
}: {
  copy: { email: string; password: string; minPassword: string; create: string; creating: string };
}) {
  const [state, action, pending] = useActionState(registerAction, idleState);
  const error = errorOf(state);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{copy.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{copy.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">{copy.minPassword}</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? copy.creating : copy.create}
      </Button>
    </form>
  );
}
