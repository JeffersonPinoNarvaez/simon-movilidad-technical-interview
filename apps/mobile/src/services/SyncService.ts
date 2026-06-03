import Constants from 'expo-constants';
import {
  sanitizeTelemetryPayload,
  type TelemetryPayload,
} from '../utils/telemetry-payload';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  'http://localhost:3001';
const GPS_INTERVAL_MS = 5000;

export type { TelemetryPayload };
export { sanitizeTelemetryPayload };

export async function sendTelemetry(payload: TelemetryPayload): Promise<boolean> {
  const body = sanitizeTelemetryPayload(payload);
  try {
    const res = await fetch(`${API_URL}/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.status === 202;
  } catch {
    return false;
  }
}

export { API_URL, GPS_INTERVAL_MS };
