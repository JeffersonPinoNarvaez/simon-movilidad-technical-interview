'use client';

import { create } from 'zustand';
import type { VehicleUpdateEvent, AlertNewEvent } from '@fleet-portal/shared';

export interface VehicleState {
  id: string;
  plate: string;
  name: string | null;
  driverName: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  lastSeen: string | null;
}

interface FleetStore {
  vehicles: Record<string, VehicleState>;
  alerts: AlertNewEvent[];
  selectedVehicleId: string | null;
  wsConnected: boolean;
  isLoadingVehicles: boolean;
  isLoadingAlerts: boolean;
  setVehicles: (vehicles: VehicleState[]) => void;
  setAlerts: (alerts: AlertNewEvent[]) => void;
  updateVehicle: (update: VehicleUpdateEvent) => void;
  addAlert: (alert: AlertNewEvent) => void;
  setSelectedVehicle: (id: string | null) => void;
  setWsConnected: (connected: boolean) => void;
  setLoadingVehicles: (loading: boolean) => void;
  setLoadingAlerts: (loading: boolean) => void;
}

export const useFleetStore = create<FleetStore>((set) => ({
  vehicles: {},
  alerts: [],
  selectedVehicleId: null,
  wsConnected: false,
  isLoadingVehicles: true,
  isLoadingAlerts: true,

  setVehicles: (vehicles) =>
    set({
      vehicles: Object.fromEntries(vehicles.map((v) => [v.id, v])),
      isLoadingVehicles: false,
    }),

  setAlerts: (alerts) => set({ alerts, isLoadingAlerts: false }),

  updateVehicle: (update) =>
    set((state) => ({
      vehicles: {
        ...state.vehicles,
        [update.vehicleId]: {
          ...(state.vehicles[update.vehicleId] ?? {
            id: update.vehicleId,
            plate: update.vehicleId.slice(0, 8),
            name: null,
            driverName: null,
            lastSeen: null,
          }),
          lat: update.lat,
          lng: update.lng,
          speedKmh: update.speedKmh,
          status: update.status,
          lastSeen: update.timestamp,
        },
      },
    })),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts.filter((a) => a.id !== alert.id)].slice(0, 50),
    })),

  setSelectedVehicle: (id) => set({ selectedVehicleId: id }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setLoadingVehicles: (loading) => set({ isLoadingVehicles: loading }),
  setLoadingAlerts: (loading) => set({ isLoadingAlerts: loading }),
}));
