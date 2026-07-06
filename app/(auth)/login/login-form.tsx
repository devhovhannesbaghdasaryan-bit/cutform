'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction, socialLoginAction } from '@/app/(auth)/actions';
import { errorOf, idleState } from '@/lib/action-state';
const providers = [
  { id: 'facebook', copyKey: 'facebook', mark: 'f' },
  { id: 'google', copyKey: 'google', mark: 'G' },
  { id: 'x', copyKey: 'x', mark: 'X' },
  { id: 'telegram', copyKey: 'telegram', mark: 'T' },
] as const;

type LoginCopy = {
  socialOptions: string;
  facebook: string;
  google: string;
  x: string;
  telegram: string;
  useEmail: string;
  email: string;
  password: string;
  login: string;
  loggingIn: string;
};

export function LoginForm({
  next,
  oauthError,
  copy,
}: {
  next: string;
  oauthError?: string;
  copy: LoginCopy;
}) {
  const [state, action, pending] = useActionState(loginAction, idleState);
  const error = errorOf(state);

  return (
    <div className="space-y-5">
      <div className="grid gap-2" aria-label={copy.socialOptions}>
        {providers.map((provider) => (
          <form action={socialLoginAction} key={provider.id}>
            <input type="hidden" name="provider" value={provider.id} />
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="outline" className="w-full justify-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-5 items-center justify-center rounded-full text-xs font-bold"
              >
                {provider.mark}
              </span>
              {copy[provider.copyKey]}
            </Button>
          </form>
        ))}
      </div>

      <div
        className="flex items-center gap-3 text-xs uppercase text-muted-foreground"
        aria-hidden="true"
      >
        <span className="h-px flex-1 bg-border" />
        {copy.useEmail}
        <span className="h-px flex-1 bg-border" />
      </div>

      {(oauthError || error) && (
        <p role="alert" className="text-sm text-destructive">
          {oauthError || error}
        </p>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
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
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? copy.loggingIn : copy.login}
        </Button>
      </form>
    </div>
  );
}
