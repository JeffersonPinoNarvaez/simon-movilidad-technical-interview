import { describe, it, expect } from 'vitest';
import { sanitizeTelemetryPayload } from '../../utils/telemetry-payload';
import { deviceIdForVehicle } from '@fleet-portal/shared';
import { OFFLINE_BATCH_SIZE } from '../../storage/offline-queue.port';

describe('mobile telemetry E2E contract', () => {
  it('uses paired device id for default vehicle ABC-123', () => {
    const vehicleId = 'a0000000-0000-4000-8000-000000000001';
    expect(deviceIdForVehicle(vehicleId)).toBe('c0000000-0000-4000-8000-000000000001');
  });

  it('sanitizes invalid GPS fields before POST', () => {
    const clean = sanitizeTelemetryPayload({
      event_id: 'e1',
      device_id: 'c0000000-0000-4000-8000-000000000001',
      vehicle_id: 'a0000000-0000-4000-8000-000000000001',
      timestamp: new Date().toISOString(),
      lat: 4.6,
      lng: -74.0,
      speed_kmh: -1,
      heading: -1,
    });
    expect(clean.speed_kmh).toBeUndefined();
    expect(clean.heading).toBeUndefined();
  });

  it('offline queue batch size matches PDF (50)', () => {
    expect(OFFLINE_BATCH_SIZE).toBe(50);
  });
});
