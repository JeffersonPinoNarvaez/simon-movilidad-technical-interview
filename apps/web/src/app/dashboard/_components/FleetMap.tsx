'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useRef, memo } from 'react';
import { useFleetStore } from '@/lib/store/fleet-store';

const COLOMBIA_CENTER: [number, number] = [4.6097, -74.0817];

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  stopped: '#eab308',
  alert: '#ef4444',
  offline: '#64748b',
};

const MARKER_ICONS: Record<string, L.DivIcon> = Object.fromEntries(
  Object.entries(STATUS_COLORS).map(([status, color]) => [
    status,
    L.divIcon({
      className: 'custom-marker',
      html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    }),
  ]),
);

function getMarkerIcon(status: string): L.DivIcon {
  return MARKER_ICONS[status] ?? MARKER_ICONS.offline;
}

function MapPanController() {
  const map = useMap();
  const selectedId = useFleetStore((s) => s.selectedVehicleId);
  const lat = useFleetStore((s) =>
    s.selectedVehicleId ? s.vehicles[s.selectedVehicleId]?.lat : null,
  );
  const lng = useFleetStore((s) =>
    s.selectedVehicleId ? s.vehicles[s.selectedVehicleId]?.lng : null,
  );
  const lastPanRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedId || lat == null || lng == null) return;

    const panKey = `${selectedId}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    if (lastPanRef.current === panKey) return;
    lastPanRef.current = panKey;

    map.panTo([lat, lng], { animate: true, duration: 0.5 });
  }, [selectedId, lat, lng, map]);

  return null;
}

const VehicleMarkers = memo(function VehicleMarkers() {
  const vehicles = useFleetStore((s) => s.vehicles);

  return (
    <>
      {Object.values(vehicles)
        .filter((v) => v.lat != null && v.lng != null)
        .map((v) => (
          <Marker
            key={v.id}
            position={[v.lat!, v.lng!]}
            icon={getMarkerIcon(v.status)}
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
    </>
  );
});

export function FleetMap() {
  return (
    <MapContainer
      center={COLOMBIA_CENTER}
      zoom={6}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapPanController />
      <VehicleMarkers />
    </MapContainer>
  );
}
