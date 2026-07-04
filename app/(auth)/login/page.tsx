import Link from 'next/link';
import { translate } from '@/lib/i18n';
import { getRequestLocale } from '@/lib/i18n-server';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const locale = await getRequestLocale();
  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">{translate(locale, 'auth.welcomeBack')}</h1>
          <p className="text-sm text-muted-foreground">{translate(locale, 'auth.loginSubtitle')}</p>
        </div>
        <LoginForm next={next ?? '/dashboard'} oauthError={error} copy={{
          socialOptions: translate(locale, 'auth.socialOptions'), facebook: translate(locale, 'auth.continueFacebook'),
          google: translate(locale, 'auth.continueGoogle'), x: translate(locale, 'auth.continueX'), telegram: translate(locale, 'auth.continueTelegram'),
          useEmail: translate(locale, 'auth.useEmail'), email: translate(locale, 'auth.email'), password: translate(locale, 'auth.password'),
          login: translate(locale, 'auth.login'), loggingIn: translate(locale, 'auth.loggingIn'),
        }} />
        <p className="text-center text-sm text-muted-foreground">
          {translate(locale, 'auth.newHere')}{' '}
          <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            {translate(locale, 'auth.createAccount')}
          </Link>
        </p>
      </div>
    </main>
  );
}
