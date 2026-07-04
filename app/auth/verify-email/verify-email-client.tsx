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

type VerifyCopy = { enterCode: string; verifying: string; verify: string; orClickLink: string; sending: string; resend: string; sent: string; logout: string; backLogin: string };

export function VerifyEmailClient({ email, signedIn, copy }: { email: string; signedIn: boolean; copy: VerifyCopy }) {
  const [verifyState, verifyAction, verifying] = useActionState(verifyOtpAction, initial);
  const [resendState, resendAction, resending] = useActionState(resendVerificationAction, initial);

  useEffect(() => {
    if (verifyState.error) toast.error(verifyState.error);
  }, [verifyState]);

  useEffect(() => {
    if (resendState.error) toast.error(resendState.error);
    else if (resendState !== initial && !resending) toast.success(copy.sent);
  }, [resendState, resending, copy.sent]);

  return (
    <div className="space-y-4 text-left">
      <form action={verifyAction} className="space-y-3">
        <input type="hidden" name="email" value={email} />
        <div className="space-y-2">
          <Label htmlFor="token">{copy.enterCode}</Label>
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
          {verifying ? copy.verifying : copy.verify}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>{copy.orClickLink}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={resendAction}>
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="outline" disabled={resending} className="w-full">
          {resending ? copy.sending : copy.resend}
        </Button>
      </form>

      {signedIn ? (
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" className="w-full">
            {copy.logout}
          </Button>
        </form>
      ) : (
        <Button asChild variant="ghost" className="w-full">
          <Link href="/login">{copy.backLogin}</Link>
        </Button>
      )}
    </div>
  );
}
