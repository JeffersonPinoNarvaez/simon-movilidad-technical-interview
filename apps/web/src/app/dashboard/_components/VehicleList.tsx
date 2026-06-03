'use client';

import { Truck, ChevronRight } from 'lucide-react';
import { useFleetStore } from '@/lib/store/fleet-store';
import { VehicleListSkeleton } from '@/components/ui/loading';
import { cn } from '@/lib/utils';

const STATUS: Record<string, { dot: string; label: string; ring: string }> = {
  active: { dot: 'bg-emerald-400', label: 'Activo', ring: 'ring-emerald-500/30' },
  stopped: { dot: 'bg-amber-400', label: 'Detenido', ring: 'ring-amber-500/30' },
  alert: { dot: 'bg-red-400', label: 'Alerta', ring: 'ring-red-500/30' },
  offline: { dot: 'bg-slate-500', label: 'Offline', ring: 'ring-slate-500/30' },
};

export function VehicleList() {
  const vehicleMap = useFleetStore((s) => s.vehicles);
  const vehicles = Object.values(vehicleMap);
  const selectedId = useFleetStore((s) => s.selectedVehicleId);
  const isLoading = useFleetStore((s) => s.isLoadingVehicles);
  const setSelected = useFleetStore((s) => s.setSelectedVehicle);

  if (isLoading) return <VehicleListSkeleton />;

  if (vehicles.length === 0) {
    return (
      <div className="py-8 text-center">
        <Truck className="mx-auto h-8 w-8 text-slate-600" />
        <p className="mt-2 text-sm text-slate-500">No hay vehículos registrados</p>
      </div>
    );
  }

  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
      {vehicles.map((v) => {
        const st = STATUS[v.status] ?? STATUS.offline;
        const selected = selectedId === v.id;
        return (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => setSelected(selected ? null : v.id)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-all',
                'hover:border-white/10 hover:bg-white/5',
                selected && 'border-emerald-500/30 bg-emerald-500/10 ring-1 ring-emerald-500/20',
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 ring-1',
                  st.ring,
                )}
              >
                <span className={cn('h-2.5 w-2.5 rounded-full', st.dot, v.status === 'active' && 'live-pulse')} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{v.plate}</p>
                <p className="truncate text-xs text-slate-400">{v.driverName ?? v.name ?? 'Sin conductor'}</p>
                {v.speedKmh != null && (
                  <p className="mt-0.5 text-[11px] text-slate-500">{Math.round(v.speedKmh)} km/h</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium uppercase text-slate-500">{st.label}</span>
                <ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:text-emerald-400" />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
