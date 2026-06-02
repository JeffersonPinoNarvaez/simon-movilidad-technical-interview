import { cn } from '@/lib/utils';

export function Card({
  className,
  children,
  title,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-lg',
        className,
      )}
    >
      {title && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>}
      {children}
    </div>
  );
}
