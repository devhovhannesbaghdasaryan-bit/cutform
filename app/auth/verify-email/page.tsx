import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { VerifyEmailClient } from './verify-email-client';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email: emailFromQuery } = await searchParams;
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations()]);

  // Already confirmed → straight to the dashboard.
  if (user?.email_confirmed_at) redirect('/dashboard');

  // Resolve which email to show: session user's email (signed in but unverified)
  // or the email passed through from the just-finished registration redirect.
  const email = user?.email ?? emailFromQuery ?? '';

  if (!email) {
    // No session and no email context — likely a stale tab; send to login.
    redirect('/login');
  }

  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t('auth.checkEmail')}</h1>
          <p className="text-muted-foreground">{t('auth.verificationSentTo', { email })}</p>
        </div>
        <VerifyEmailClient
          email={email}
          signedIn={!!user}
          copy={{
            enterCode: t('auth.enterCode'),
            verifying: t('auth.verifying'),
            verify: t('auth.verify'),
            orClickLink: t('auth.orClickLink'),
            sending: t('auth.sending'),
            resend: t('auth.resend'),
            sent: t('auth.sent'),
            logout: t('auth.logout'),
            backLogin: t('auth.backLogin'),
          }}
        />
        <p className="text-xs text-muted-foreground">{t('auth.spamNotice')}</p>
      </div>
    </main>
  );
}
