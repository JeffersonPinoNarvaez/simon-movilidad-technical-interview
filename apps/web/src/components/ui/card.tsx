import { cn } from '@/lib/utils';

export function Card({
  className,
  children,
  title,
  glow = false,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-slate-900/40 p-5 shadow-xl backdrop-blur-md',
        glow && 'shadow-emerald-900/5 ring-1 ring-white/5',
        className,
      )}
    >
      {title && (
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
