import { describe, it, expect } from 'vitest';
import { telemetryIngestSchema, DEDUP_BUCKET_MS, STOPPED_THRESHOLD_MINUTES, CRITICAL_ZONE_STOPPED_MINUTES } from '../index.js';

describe('telemetryIngestSchema', () => {
  it('validates correct payload', () => {
    const result = telemetryIngestSchema.safeParse({
      event_id: 'b0000000-0000-4000-8000-000000000001',
      device_id: 'c0000000-0000-4000-8000-000000000001',
      vehicle_id: 'a0000000-0000-4000-8000-000000000001',
      timestamp: '2025-01-01T12:00:00Z',
      lat: 4.6,
      lng: -74.0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid latitude', () => {
    const result = telemetryIngestSchema.safeParse({
      event_id: 'b0000000-0000-4000-8000-000000000001',
      device_id: 'c0000000-0000-4000-8000-000000000001',
      vehicle_id: 'a0000000-0000-4000-8000-000000000001',
      timestamp: '2025-01-01T12:00:00Z',
      lat: 999,
      lng: -74.0,
    });
    expect(result.success).toBe(false);
  });
});

describe('constants', () => {
  it('dedup bucket is 5 seconds', () => {
    expect(DEDUP_BUCKET_MS).toBe(5000);
  });

  it('stopped threshold is 20 minutes', () => {
    expect(STOPPED_THRESHOLD_MINUTES).toBe(20);
    expect(CRITICAL_ZONE_STOPPED_MINUTES).toBe(20);
  });
});
