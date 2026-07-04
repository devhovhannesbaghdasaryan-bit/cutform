import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { translate, translateTemplate } from '@/lib/i18n';
import { getRequestLocale } from '@/lib/i18n-server';
import { VerifyEmailClient } from './verify-email-client';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email: emailFromQuery } = await searchParams;
  const [supabase, locale] = await Promise.all([getServerSupabase(), getRequestLocale()]);
  const { data: { user } } = await supabase.auth.getUser();

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
          <h1 className="text-3xl font-bold">{translate(locale, 'auth.checkEmail')}</h1>
          <p className="text-muted-foreground">
            {translateTemplate(locale, 'auth.verificationSentTo', { email })}
          </p>
        </div>
        <VerifyEmailClient email={email} signedIn={!!user} copy={{ enterCode: translate(locale, 'auth.enterCode'), verifying: translate(locale, 'auth.verifying'), verify: translate(locale, 'auth.verify'), orClickLink: translate(locale, 'auth.orClickLink'), sending: translate(locale, 'auth.sending'), resend: translate(locale, 'auth.resend'), sent: translate(locale, 'auth.sent'), logout: translate(locale, 'auth.logout'), backLogin: translate(locale, 'auth.backLogin') }} />
        <p className="text-xs text-muted-foreground">
          {translate(locale, 'auth.spamNotice')}
        </p>
      </div>
    </main>
  );
}
