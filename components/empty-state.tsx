import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed py-16 text-center">
      <div className="rounded-full bg-muted p-3">
        <Sparkles className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">No products yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Upload an image, chat with the AI to refine the design, then save it as a priced product.
        </p>
      </div>
      <Button asChild>
        <Link href="/create">Create your first product</Link>
      </Button>
    </div>
  );
}
