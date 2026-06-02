'use client';

import { useFleetStore } from '@/lib/store/fleet-store';

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  stopped: 'bg-yellow-500',
  alert: 'bg-red-500',
  offline: 'bg-slate-500',
};

export function VehicleList() {
  const vehicles = useFleetStore((s) => Object.values(s.vehicles));
  const selectedId = useFleetStore((s) => s.selectedVehicleId);
  const setSelected = useFleetStore((s) => s.setSelectedVehicle);

  if (vehicles.length === 0) {
    return <p className="text-sm text-slate-500">No hay vehículos registrados.</p>;
  }

  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto">
      {vehicles.map((v) => (
        <li key={v.id}>
          <button
            type="button"
            onClick={() => setSelected(v.id === selectedId ? null : v.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-800/60 ${
              selectedId === v.id ? 'bg-slate-800 ring-1 ring-emerald-600/50' : ''
            }`}
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[v.status] ?? STATUS_DOT.offline}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{v.plate}</p>
              <p className="text-xs text-slate-500 truncate">{v.driverName ?? v.name ?? '—'}</p>
            </div>
            <span className="text-xs capitalize text-slate-400">{v.status}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
