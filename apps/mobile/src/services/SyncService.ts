const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const GPS_INTERVAL_MS = 5000;

export interface TelemetryPayload {
  event_id: string;
  device_id: string;
  vehicle_id: string;
  timestamp: string;
  lat: number;
  lng: number;
  speed_kmh?: number;
  heading?: number;
  fuel_level?: number;
}

export async function sendTelemetry(payload: TelemetryPayload): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.status === 202;
  } catch {
    return false;
  }
}

export { API_URL, GPS_INTERVAL_MS };
