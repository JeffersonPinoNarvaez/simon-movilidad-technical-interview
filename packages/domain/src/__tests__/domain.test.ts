import { describe, it, expect } from 'vitest';
import { Coordinates, Speed } from '../value-objects/coordinates.js';
import { VehicleId, DeviceId } from '../value-objects/ids.js';
import { TelemetryEvent } from '../entities/telemetry-event.js';

describe('Coordinates', () => {
  it('creates valid coordinates', () => {
    const coords = Coordinates.create(4.6097, -74.0817);
    expect(coords.lat).toBe(4.6097);
    expect(coords.lng).toBe(-74.0817);
  });

  it('rejects invalid latitude', () => {
    expect(() => Coordinates.create(91, 0)).toThrow('Latitude');
  });
});

describe('TelemetryEvent', () => {
  it('serializes to JSON correctly', () => {
    const event = TelemetryEvent.create({
      time: new Date('2025-01-01T00:00:00Z'),
      deviceId: DeviceId.create('a0000000-0000-4000-8000-000000000001'),
      vehicleId: VehicleId.create('a0000000-0000-4000-8000-000000000001'),
      coordinates: Coordinates.create(4.6, -74.0),
      speed: Speed.create(60),
      heading: 180,
      fuelLevel: 75,
      status: 'active',
      metadata: {},
    });

    const json = event.toJSON();
    expect(json.speedKmh).toBe(60);
    expect(json.status).toBe('active');
  });
});
