import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const t = await getTranslations();
  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">{t('auth.welcomeBack')}</h1>
          <p className="text-sm text-muted-foreground">{t('auth.loginSubtitle')}</p>
        </div>
        <LoginForm
          next={next ?? '/dashboard'}
          oauthError={error}
          copy={{
            socialOptions: t('auth.socialOptions'),
            facebook: t('auth.continueFacebook'),
            google: t('auth.continueGoogle'),
            useEmail: t('auth.useEmail'),
            email: t('auth.email'),
            password: t('auth.password'),
            login: t('auth.login'),
            loggingIn: t('auth.loggingIn'),
          }}
        />
        <p className="text-center text-sm text-muted-foreground">
          {t('auth.newHere')}{' '}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('auth.createAccount')}
          </Link>
        </p>
      </div>
    </main>
  );
}
