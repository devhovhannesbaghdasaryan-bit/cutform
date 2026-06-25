import { cn } from '@/lib/utils';

export function NightLightPreview({
  text,
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative aspect-[4/3] overflow-hidden rounded-lg border bg-slate-950 p-6', className)}>
      <div className="absolute inset-x-12 top-8 h-[68%] rounded-t-[48%] border border-cyan-200/70 bg-cyan-100/15 shadow-[0_0_40px_rgba(125,211,252,0.35)]" />
      <div className="absolute inset-x-20 bottom-10 h-12 rounded-md border border-amber-900/40 bg-[linear-gradient(90deg,#7c4a24,#c48a4a,#7c4a24)] shadow-lg" />
      <div className="absolute inset-x-24 bottom-20 h-5 rounded bg-amber-950/80" />
      <div className="absolute left-1/2 top-[35%] h-28 w-28 -translate-x-1/2 rounded-full border border-cyan-100/70" />
      <p className="absolute inset-x-20 bottom-14 truncate text-center text-sm font-semibold text-amber-50">
        {text || 'Base text'}
      </p>
    </div>
  );
}
