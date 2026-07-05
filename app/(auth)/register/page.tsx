import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { RegisterForm } from './register-form';

export default async function RegisterPage() {
  const t = await getTranslations();
  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">{t('auth.createYourAccount')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('auth.verificationNotice')}
          </p>
        </div>
        <RegisterForm copy={{ email: t('auth.email'), password: t('auth.password'), minPassword: t('auth.minPassword'), create: t('auth.createAccount'), creating: t('auth.creatingAccount') }} />
        <p className="text-center text-sm text-muted-foreground">
          {t('auth.alreadyAccount')}{' '}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </main>
  );
}
