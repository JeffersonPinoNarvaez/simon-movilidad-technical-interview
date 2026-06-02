'use client';

import { useFleetStore } from '@/lib/store/fleet-store';

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'border-red-500/50 bg-red-950/30',
  warning: 'border-yellow-500/50 bg-yellow-950/30',
  info: 'border-blue-500/50 bg-blue-950/30',
};

export function AlertsFeed() {
  const alerts = useFleetStore((s) => s.alerts);

  if (alerts.length === 0) {
    return <p className="text-sm text-slate-500">Sin alertas activas en tiempo real.</p>;
  }

  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto">
      {alerts.map((a) => (
        <li
          key={a.id}
          className={`rounded-lg border px-3 py-2 text-sm ${SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.info}`}
        >
          <p className="font-medium capitalize">{a.type}</p>
          <p className="text-slate-300">{a.message}</p>
          <p className="mt-1 text-xs text-slate-500">
            {new Date(a.createdAt).toLocaleTimeString('es-CO')}
          </p>
        </li>
      ))}
    </ul>
  );
}
