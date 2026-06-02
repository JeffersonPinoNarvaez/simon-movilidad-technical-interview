'use client';

import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ToastContainer } from '@/components/ui/toast';
import { MapSkeleton } from '@/components/ui/loading';
import { VehicleList } from './_components/VehicleList';
import { AlertsFeed } from './_components/AlertsFeed';
import { AgentChat } from './_components/AgentChat';
import { ConnectionBanner } from './_components/ConnectionBanner';
import { useFleetStore } from '@/lib/store/fleet-store';
import { pushAlertToast } from '@/lib/store/toast-store';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { VehicleUpdateEvent, AlertNewEvent } from '@fleet-portal/shared';

const FleetMap = dynamic(() => import('./_components/FleetMap').then((m) => m.FleetMap), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

interface VehicleResponse {
  data: Array<{
    id: string;
    plate: string;
    name: string | null;
    driverName: string | null;
    status: string;
    lastSeen: string | null;
    coordinates: { lat: number; lng: number } | null;
  }>;
}

interface AlertsResponse {
  data: Array<{
    id: string;
    vehicleId: string;
    type: string;
    message: string;
    severity: string;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const setVehicles = useFleetStore((s) => s.setVehicles);
  const setAlerts = useFleetStore((s) => s.setAlerts);
  const updateVehicle = useFleetStore((s) => s.updateVehicle);
  const addAlert = useFleetStore((s) => s.addAlert);
  const setWsConnected = useFleetStore((s) => s.setWsConnected);
  const wsConnected = useFleetStore((s) => s.wsConnected);
  const vehicleCount = useFleetStore((s) => Object.keys(s.vehicles).length);
  const alertCount = useFleetStore((s) => s.alerts.length);

  useEffect(() => {
    apiFetch<VehicleResponse>('/vehicles')
      .then((res) => {
        setVehicles(
          res.data.map((v) => ({
            id: v.id,
            plate: v.plate,
            name: v.name,
            driverName: v.driverName,
            status: v.status,
            lat: v.coordinates?.lat ?? null,
            lng: v.coordinates?.lng ?? null,
            speedKmh: null,
            lastSeen: v.lastSeen,
          })),
        );
      })
      .catch(() => useFleetStore.getState().setLoadingVehicles(false));

    apiFetch<AlertsResponse>('/alerts')
      .then((res) => {
        setAlerts(
          res.data.map((a) => ({
            id: a.id,
            vehicleId: a.vehicleId,
            type: a.type,
            message: a.message,
            severity: a.severity,
            createdAt: a.createdAt,
          })),
        );
      })
      .catch(() => useFleetStore.getState().setLoadingAlerts(false));
  }, [setVehicles, setAlerts]);

  useEffect(() => {
    const socket = getSocket(setWsConnected);

    socket.on('vehicle:update', (payload: VehicleUpdateEvent) => {
      updateVehicle(payload);
    });

    socket.on('alert:new', (payload: AlertNewEvent) => {
      addAlert(payload);
      pushAlertToast(payload);
    });

    socket.on('vehicle:offline', ({ vehicleId }: { vehicleId: string }) => {
      updateVehicle({
        vehicleId,
        deviceId: '',
        lat: 0,
        lng: 0,
        speedKmh: null,
        status: 'offline',
        timestamp: new Date().toISOString(),
      });
    });

    return () => {
      socket.off('vehicle:update');
      socket.off('alert:new');
      socket.off('vehicle:offline');
    };
  }, [updateVehicle, addAlert, setWsConnected]);

  const headerBadge = useMemo(
    () => (wsConnected ? 'live' : 'warning') as 'live' | 'warning',
    [wsConnected],
  );

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-slate-950 to-slate-950" />
      <div className="relative p-4 md:p-6 lg:p-8">
        <ToastContainer />

        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/80">
              FleetPortal
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
              Centro de Monitoreo
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Telemetría en tiempo real · Colombia · {vehicleCount} vehículos · {alertCount} alertas
            </p>
          </div>
          <Badge variant={headerBadge}>
            {wsConnected ? 'En vivo' : 'Reconectando…'}
          </Badge>
        </header>

        {!wsConnected && <ConnectionBanner />}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-8">
            <Card className="h-[520px] overflow-hidden p-0" title="Mapa de flota" glow>
              <FleetMap />
            </Card>
          </div>
          <div className="flex flex-col gap-5 lg:col-span-4">
            <Card className="min-h-[240px]" title="Vehículos" glow>
              <VehicleList />
            </Card>
            <Card className="min-h-[240px]" title="Alertas" glow>
              <AlertsFeed />
            </Card>
          </div>
          <div className="lg:col-span-12">
            <Card title="Agente IA — Operaciones de flota" glow>
              <AgentChat />
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
