'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import { useFleetStore } from '@/lib/store/fleet-store';

const COLOMBIA_CENTER: [number, number] = [4.6097, -74.0817];

function createIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  stopped: '#eab308',
  alert: '#ef4444',
  offline: '#64748b',
};

function MapPanController() {
  const map = useMap();
  const selectedId = useFleetStore((s) => s.selectedVehicleId);
  const vehicles = useFleetStore((s) => s.vehicles);

  useEffect(() => {
    if (!selectedId) return;
    const vehicle = vehicles[selectedId];
    if (vehicle?.lat != null && vehicle?.lng != null) {
      map.panTo([vehicle.lat, vehicle.lng], { animate: true, duration: 0.5 });
    }
  }, [selectedId, vehicles, map]);

  return null;
}

export function FleetMap() {
  const vehicles = useFleetStore((s) => Object.values(s.vehicles));

  return (
    <MapContainer center={COLOMBIA_CENTER} zoom={6} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapPanController />
      {vehicles
        .filter((v) => v.lat != null && v.lng != null)
        .map((v) => (
          <Marker
            key={v.id}
            position={[v.lat!, v.lng!]}
            icon={createIcon(STATUS_COLORS[v.status] ?? STATUS_COLORS.offline)}
          >
            <Popup>
              <strong>{v.plate}</strong>
              <br />
              {v.name ?? 'Sin nombre'}
              <br />
              Estado: {v.status}
              {v.speedKmh != null && (
                <>
                  <br />
                  Velocidad: {v.speedKmh.toFixed(0)} km/h
                </>
              )}
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
