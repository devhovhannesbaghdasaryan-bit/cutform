import Link from 'next/link';
import { translate } from '@/lib/i18n';
import { getRequestLocale } from '@/lib/i18n-server';
import { RegisterForm } from './register-form';

export default async function RegisterPage() {
  const locale = await getRequestLocale();
  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">{translate(locale, 'auth.createYourAccount')}</h1>
          <p className="text-sm text-muted-foreground">
            {translate(locale, 'auth.verificationNotice')}
          </p>
        </div>
        <RegisterForm copy={{ email: translate(locale, 'auth.email'), password: translate(locale, 'auth.password'), minPassword: translate(locale, 'auth.minPassword'), create: translate(locale, 'auth.createAccount'), creating: translate(locale, 'auth.creatingAccount') }} />
        <p className="text-center text-sm text-muted-foreground">
          {translate(locale, 'auth.alreadyAccount')}{' '}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            {translate(locale, 'auth.login')}
          </Link>
        </p>
      </div>
    </main>
  );
}
