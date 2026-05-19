import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getServerSupabase } from '@/lib/supabase/server';

export default async function LandingPage() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email_confirmed_at) redirect('/dashboard');

  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-8 py-16 text-center">
      <div className="space-y-3">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">Snip</h1>
        <p className="text-xl text-muted-foreground sm:text-2xl">
          Turn any image into a manufacturing-ready SVG with AI.
        </p>
      </div>
      <p className="max-w-xl text-muted-foreground">
        Upload a reference. Chat with the AI to refine. Approve. Your SVG is priced
        transparently — what the AI cost plus a flat $10.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/register">Get started</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </main>
  );
}
