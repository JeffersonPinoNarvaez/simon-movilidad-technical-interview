import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IngestTelemetryUseCase } from '../ingest-telemetry.use-case.js';
import { DuplicateEventError } from '@fleet-portal/domain';
import type { IDeviceRepository } from '@fleet-portal/domain';
import type { ICache, IMessageBroker } from '../../ports/index.js';

const deviceRepo: IDeviceRepository = {
  findById: vi.fn().mockResolvedValue({
    id: 'c0000000-0000-4000-8000-000000000001',
    vehicleId: 'a0000000-0000-4000-8000-000000000001',
  }),
};

describe('IngestTelemetryUseCase', () => {
  let cache: ICache;
  let messageBroker: IMessageBroker;
  let useCase: IngestTelemetryUseCase;

  beforeEach(() => {
    vi.mocked(deviceRepo.findById).mockResolvedValue({
      id: 'c0000000-0000-4000-8000-000000000001',
      vehicleId: 'a0000000-0000-4000-8000-000000000001',
    });
    cache = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      increment: vi.fn(),
      publish: vi.fn(),
      isDuplicate: vi.fn().mockResolvedValue(false),
    };
    messageBroker = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      publish: vi.fn(),
      subscribe: vi.fn(),
    };
    useCase = new IngestTelemetryUseCase(cache, messageBroker, deviceRepo);
  });

  it('publishes valid telemetry to kafka', async () => {
    const result = await useCase.execute({
      dto: {
        event_id: 'b0000000-0000-4000-8000-000000000001',
        device_id: 'c0000000-0000-4000-8000-000000000001',
        vehicle_id: 'a0000000-0000-4000-8000-000000000001',
        timestamp: '2025-01-01T12:00:00Z',
        lat: 4.6,
        lng: -74.0,
        speed_kmh: 45,
      },
    });

    expect(result.accepted).toBe(true);
    expect(messageBroker.publish).toHaveBeenCalledOnce();
  });

  it('rejects duplicate events', async () => {
    vi.mocked(cache.isDuplicate).mockResolvedValue(true);

    await expect(
      useCase.execute({
        dto: {
          event_id: 'b0000000-0000-4000-8000-000000000002',
          device_id: 'c0000000-0000-4000-8000-000000000001',
          vehicle_id: 'a0000000-0000-4000-8000-000000000001',
          timestamp: '2025-01-01T12:00:00Z',
          lat: 4.6,
          lng: -74.0,
        },
      }),
    ).rejects.toThrow(DuplicateEventError);

    expect(cache.increment).toHaveBeenCalledWith('dedup:dropped');
  });

  it('rejects device not registered for vehicle', async () => {
    vi.mocked(deviceRepo.findById).mockResolvedValue({
      id: 'c0000000-0000-4000-8000-000000000001',
      vehicleId: 'a0000000-0000-4000-8000-000000000099',
    });

    await expect(
      useCase.execute({
        dto: {
          event_id: 'b0000000-0000-4000-8000-000000000003',
          device_id: 'c0000000-0000-4000-8000-000000000001',
          vehicle_id: 'a0000000-0000-4000-8000-000000000001',
          timestamp: '2025-01-01T12:00:00Z',
          lat: 4.6,
          lng: -74.0,
        },
      }),
    ).rejects.toThrow('not registered');
  });
});
