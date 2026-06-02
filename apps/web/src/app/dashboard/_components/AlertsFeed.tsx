'use client';

import { AlertTriangle, Fuel, Gauge, MapPin, ShieldAlert, Clock } from 'lucide-react';
import { useFleetStore } from '@/lib/store/fleet-store';
import { AlertsSkeleton } from '@/components/ui/loading';
import { cn } from '@/lib/utils';

const ALERT_META: Record<string, { icon: typeof AlertTriangle; accent: string; glow: string }> = {
  critical_zone: {
    icon: ShieldAlert,
    accent: 'border-red-400/40 bg-gradient-to-br from-red-950/60 to-slate-900/40',
    glow: 'shadow-red-500/10',
  },
  speeding: {
    icon: Gauge,
    accent: 'border-orange-400/40 bg-gradient-to-br from-orange-950/50 to-slate-900/40',
    glow: 'shadow-orange-500/10',
  },
  stopped: {
    icon: Clock,
    accent: 'border-amber-400/40 bg-gradient-to-br from-amber-950/50 to-slate-900/40',
    glow: 'shadow-amber-500/10',
  },
  fuel: {
    icon: Fuel,
    accent: 'border-yellow-400/40 bg-gradient-to-br from-yellow-950/40 to-slate-900/40',
    glow: 'shadow-yellow-500/10',
  },
  default: {
    icon: MapPin,
    accent: 'border-blue-400/40 bg-gradient-to-br from-blue-950/40 to-slate-900/40',
    glow: 'shadow-blue-500/10',
  },
};

export function AlertsFeed() {
  const alerts = useFleetStore((s) => s.alerts);
  const isLoadingAlerts = useFleetStore((s) => s.isLoadingAlerts);

  if (isLoadingAlerts) return <AlertsSkeleton />;

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <ShieldAlert className="h-6 w-6 text-emerald-400/60" />
        </div>
        <p className="text-sm font-medium text-slate-300">Sin alertas activas</p>
        <p className="mt-1 text-xs text-slate-500">La flota opera con normalidad</p>
      </div>
    );
  }

  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
      {alerts.map((a, index) => {
        const meta = ALERT_META[a.type] ?? ALERT_META.default;
        const Icon = meta.icon;
        return (
          <li
            key={a.id}
            className={cn(
              'alert-slide-in rounded-xl border p-3 shadow-lg backdrop-blur-sm transition hover:scale-[1.01]',
              meta.accent,
              meta.glow,
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/20">
                <Icon className="h-4 w-4 text-white/90" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/90">
                    {a.type.replace('_', ' ')}
                  </p>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase',
                      a.severity === 'critical' && 'bg-red-500/20 text-red-300',
                      a.severity === 'warning' && 'bg-amber-500/20 text-amber-300',
                      a.severity === 'info' && 'bg-blue-500/20 text-blue-300',
                    )}
                  >
                    {a.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-snug text-slate-300">{a.message}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  {new Date(a.createdAt).toLocaleString('es-CO')}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
