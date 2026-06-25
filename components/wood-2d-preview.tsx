import { cn } from '@/lib/utils';

export function Wood2DPreview({ className }: { className?: string }) {
  return (
    <div className={cn('relative aspect-[4/3] overflow-hidden rounded-lg border bg-[#d6a15f] p-6', className)}>
      <div className="absolute inset-0 opacity-40 [background:repeating-linear-gradient(90deg,#8b5a2b_0,#8b5a2b_2px,transparent_2px,transparent_38px)]" />
      <div className="relative flex h-full w-full items-center justify-center rounded-md border-2 border-dashed border-amber-950/70 bg-amber-100/25">
        <div className="h-36 w-36 rounded-[38%_62%_48%_52%] border-4 border-amber-950/80 bg-amber-200/40 shadow-inner" />
        <div className="absolute h-20 w-20 rounded-full border-2 border-amber-950/50" />
        <p className="absolute bottom-4 text-xs font-medium uppercase text-amber-950/70">cut + engrave preview</p>
      </div>
    </div>
  );
}
