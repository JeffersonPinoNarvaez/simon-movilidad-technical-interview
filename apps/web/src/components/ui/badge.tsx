import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-slate-800/80 text-slate-200 ring-1 ring-white/10',
  success: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  danger: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30',
  live: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40 live-pulse',
};

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm',
        variants[variant],
        className,
      )}
    >
      {variant === 'live' && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 live-pulse" />
      )}
      {children}
    </span>
  );
}
