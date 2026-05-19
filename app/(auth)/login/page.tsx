import Link from 'next/link';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Log in to your Snip account.</p>
        </div>
        <LoginForm next={next ?? '/dashboard'} />
        <p className="text-center text-sm text-muted-foreground">
          New here?{' '}
          <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
