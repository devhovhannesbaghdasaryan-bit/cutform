'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction } from '@/app/(auth)/actions';
import { SocialLoginButtons } from '@/app/(auth)/social-login-buttons';
import { errorOf, idleState } from '@/lib/action-state';

type LoginCopy = {
  socialOptions: string;
  facebook: string;
  google: string;
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
      <SocialLoginButtons next={next} copy={copy} />

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
