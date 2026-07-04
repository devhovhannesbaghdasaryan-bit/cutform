import Link from 'next/link';
import { Store } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyState({ copy }: { copy: { title: string; description: string; browse: string } }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed py-16 text-center">
      <div className="rounded-full bg-muted p-3">
        <Store className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{copy.title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {copy.description}
        </p>
      </div>
      <Button asChild>
        <Link href="/catalog">{copy.browse}</Link>
      </Button>
    </div>
  );
}
