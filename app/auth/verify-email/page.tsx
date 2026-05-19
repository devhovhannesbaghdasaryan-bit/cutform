import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { VerifyEmailClient } from './verify-email-client';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email: emailFromQuery } = await searchParams;
  const supabase = await getServerSupabase();
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
          <h1 className="text-3xl font-bold">Check your email</h1>
          <p className="text-muted-foreground">
            We sent a verification link to <span className="font-medium text-foreground">{email}</span>.
            Click the link to activate your account.
          </p>
        </div>
        <VerifyEmailClient email={email} signedIn={!!user} />
        <p className="text-xs text-muted-foreground">
          Not seeing it? Check your spam folder. Links expire after 24 hours.
        </p>
      </div>
    </main>
  );
}
