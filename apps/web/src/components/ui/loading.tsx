import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gradient-to-r from-slate-800/80 via-slate-700/50 to-slate-800/80 bg-[length:200%_100%]',
        className,
      )}
      style={{ animation: 'shimmer 1.8s ease-in-out infinite' }}
    />
  );
}

export function VehicleListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function AlertsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-900/50">
      <Spinner size="lg" />
      <p className="text-sm text-slate-400">Cargando mapa de flota…</p>
    </div>
  );
}

export function Spinner({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400',
        sizes[size],
        className,
      )}
      role="status"
      aria-label="Cargando"
    />
  );
}
