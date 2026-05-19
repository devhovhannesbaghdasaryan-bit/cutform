'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  resendVerificationAction,
  verifyOtpAction,
  logoutAction,
  type AuthFormState,
} from '@/app/(auth)/actions';

const initial: AuthFormState = { error: null };

export function VerifyEmailClient({ email, signedIn }: { email: string; signedIn: boolean }) {
  const [verifyState, verifyAction, verifying] = useActionState(verifyOtpAction, initial);
  const [resendState, resendAction, resending] = useActionState(resendVerificationAction, initial);

  useEffect(() => {
    if (verifyState.error) toast.error(verifyState.error);
  }, [verifyState]);

  useEffect(() => {
    if (resendState.error) toast.error(resendState.error);
    else if (resendState !== initial && !resending) toast.success('Verification email sent.');
  }, [resendState, resending]);

  return (
    <div className="space-y-4 text-left">
      <form action={verifyAction} className="space-y-3">
        <input type="hidden" name="email" value={email} />
        <div className="space-y-2">
          <Label htmlFor="token">Enter the 6-digit code from your email</Label>
          <Input
            id="token"
            name="token"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="123456"
            required
            className="text-center tracking-[0.5em] text-lg"
          />
        </div>
        <Button type="submit" className="w-full" disabled={verifying}>
          {verifying ? 'Verifying…' : 'Verify'}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>or click the link in the email</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={resendAction}>
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="outline" disabled={resending} className="w-full">
          {resending ? 'Sending…' : 'Resend verification email'}
        </Button>
      </form>

      {signedIn ? (
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" className="w-full">
            Log out
          </Button>
        </form>
      ) : (
        <Button asChild variant="ghost" className="w-full">
          <Link href="/login">Back to log in</Link>
        </Button>
      )}
    </div>
  );
}
