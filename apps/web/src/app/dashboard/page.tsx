'use client';

import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { VehicleList } from './_components/VehicleList';
import { AlertsFeed } from './_components/AlertsFeed';
import { AgentChat } from './_components/AgentChat';
import { ConnectionBanner } from './_components/ConnectionBanner';
import { useFleetStore } from '@/lib/store/fleet-store';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { VehicleUpdateEvent, AlertNewEvent } from '@fleet-portal/shared';

const FleetMap = dynamic(() => import('./_components/FleetMap').then((m) => m.FleetMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-400">Cargando mapa...</div>
  ),
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

export default function DashboardPage() {
  const setVehicles = useFleetStore((s) => s.setVehicles);
  const updateVehicle = useFleetStore((s) => s.updateVehicle);
  const addAlert = useFleetStore((s) => s.addAlert);
  const setWsConnected = useFleetStore((s) => s.setWsConnected);
  const wsConnected = useFleetStore((s) => s.wsConnected);

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
      .catch(console.error);
  }, [setVehicles]);

  useEffect(() => {
    const socket = getSocket(setWsConnected);

    socket.on('vehicle:update', (payload: VehicleUpdateEvent) => {
      updateVehicle(payload);
    });

    socket.on('alert:new', (payload: AlertNewEvent) => {
      addAlert(payload);
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

  const headerStatus = useMemo(
    () => (wsConnected ? 'Conectado en tiempo real' : 'Reconectando...'),
    [wsConnected],
  );

  return (
    <main className="min-h-screen p-4 md:p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">FleetPortal</h1>
          <p className="text-sm text-slate-400">Monitoreo de flota en tiempo real — Colombia</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            wsConnected ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'
          }`}
        >
          {headerStatus}
        </span>
      </header>

      {!wsConnected && <ConnectionBanner />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-8">
          <Card className="h-[480px] p-0 overflow-hidden" title="Mapa de flota">
            <FleetMap />
          </Card>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-4">
          <Card className="flex-1 min-h-[200px]" title="Vehículos">
            <VehicleList />
          </Card>
          <Card className="flex-1 min-h-[200px]" title="Alertas">
            <AlertsFeed />
          </Card>
        </div>
        <div className="lg:col-span-12">
          <Card title="Agente IA">
            <AgentChat />
          </Card>
        </div>
      </div>
    </main>
  );
}
