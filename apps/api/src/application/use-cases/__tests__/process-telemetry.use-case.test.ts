import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessTelemetryUseCase } from '../process-telemetry.use-case.js';
import { ZoneEnrichmentService } from '../../services/zone-enrichment.service.js';
import { OpossumAdapter } from '../../../infrastructure/circuit-breaker/opossum.adapter.js';
import { CriticalZone } from '@fleet-portal/domain';

const criticalZone = CriticalZone.create({
  id: 'd0000000-0000-4000-8000-000000000001',
  name: 'Bogotá Centro',
  bounds: { latMin: 4.55, latMax: 4.68, lngMin: -74.12, lngMax: -74.05 },
});

describe('ProcessTelemetryUseCase integration', () => {
  let useCase: ProcessTelemetryUseCase;
  let alertRepo: {
    save: ReturnType<typeof vi.fn>;
    findActive: ReturnType<typeof vi.fn>;
    hasActiveAlert: ReturnType<typeof vi.fn>;
  };

  const stoppedSessionRepo = {
    upsert: vi.fn(),
    clear: vi.fn(),
    findByVehicleId: vi.fn().mockResolvedValue({
      stoppedSince: new Date(Date.now() - 25 * 60 * 1000),
      zoneId: criticalZone.id,
    }),
    findStoppedInCriticalZone: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    alertRepo = {
      save: vi.fn(),
      findActive: vi.fn(),
      hasActiveAlert: vi.fn().mockResolvedValue(false),
    };
    useCase = new ProcessTelemetryUseCase(
      { save: vi.fn(), findByVehicleId: vi.fn(), refreshCurrentStateView: vi.fn() },
      alertRepo,
      { updateStatus: vi.fn(), findAll: vi.fn(), findById: vi.fn() },
      stoppedSessionRepo,
      { resolveZone: vi.fn().mockResolvedValue(criticalZone) } as unknown as ZoneEnrichmentService,
      { publish: vi.fn().mockResolvedValue(undefined) },
      { emitVehicleUpdate: vi.fn(), emitAlert: vi.fn() },
      new OpossumAdapter(),
    );
  });

  it('creates critical_zone alert when stopped 20+ min in critical zone', async () => {
    const result = await useCase.execute({
      eventId: 'e1',
      deviceId: 'c0000000-0000-4000-8000-000000000001',
      vehicleId: 'a0000000-0000-4000-8000-000000000001',
      timestamp: new Date().toISOString(),
      lat: 4.6097,
      lng: -74.0817,
      speedKmh: 0,
    });

    expect(result.alerts.some((a) => a.type === 'critical_zone')).toBe(true);
    expect(stoppedSessionRepo.upsert).toHaveBeenCalled();
    expect(alertRepo.save).toHaveBeenCalled();
  });

  it('skips duplicate alert when same type is already active', async () => {
    alertRepo.hasActiveAlert.mockResolvedValue(true);

    await useCase.execute({
      eventId: 'e2',
      deviceId: 'c0000000-0000-4000-8000-000000000001',
      vehicleId: 'a0000000-0000-4000-8000-000000000001',
      timestamp: new Date().toISOString(),
      lat: 4.6097,
      lng: -74.0817,
      speedKmh: 0,
    });

    expect(alertRepo.hasActiveAlert).toHaveBeenCalledWith(
      expect.anything(),
      'critical_zone',
    );
    expect(alertRepo.save).not.toHaveBeenCalled();
  });
});
