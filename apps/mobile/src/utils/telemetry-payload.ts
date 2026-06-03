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

/** iOS often reports speed/heading as -1 when unknown; API rejects values outside schema. */
export function sanitizeTelemetryPayload(payload: TelemetryPayload): TelemetryPayload {
  const clean = { ...payload };
  if (
    clean.speed_kmh == null ||
    !Number.isFinite(clean.speed_kmh) ||
    clean.speed_kmh < 0
  ) {
    delete clean.speed_kmh;
  }
  if (
    clean.heading == null ||
    !Number.isFinite(clean.heading) ||
    clean.heading < 0 ||
    clean.heading > 360
  ) {
    delete clean.heading;
  }
  return clean;
}
