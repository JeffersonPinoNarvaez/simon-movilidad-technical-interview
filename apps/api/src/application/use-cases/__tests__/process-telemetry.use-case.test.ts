import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessTelemetryUseCase } from '../process-telemetry.use-case.js';
import { ZoneEnrichmentService } from '../../services/zone-enrichment.service.js';
import { OpossumAdapter } from '../../../infrastructure/circuit-breaker/opossum.adapter.js';
import { CriticalZone } from '@fleet-portal/domain';
import { SPEED_LIMIT_KMH, FUEL_LOW_THRESHOLD } from '@fleet-portal/shared';

const criticalZone = CriticalZone.create({
  id: 'd0000000-0000-4000-8000-000000000001',
  name: 'Bogotá Centro',
  bounds: { latMin: 4.55, latMax: 4.68, lngMin: -74.12, lngMax: -74.05 },
});

const basePayload = {
  deviceId: 'c0000000-0000-4000-8000-000000000001',
  vehicleId: 'a0000000-0000-4000-8000-000000000001',
  timestamp: new Date().toISOString(),
  lat: 4.6097,
  lng: -74.0817,
};

describe('ProcessTelemetryUseCase integration', () => {
  let useCase: ProcessTelemetryUseCase;
  let alertRepo: {
    save: ReturnType<typeof vi.fn>;
    findActive: ReturnType<typeof vi.fn>;
    hasActiveAlert: ReturnType<typeof vi.fn>;
  };
  let wsGateway: { emitVehicleUpdate: ReturnType<typeof vi.fn>; emitAlert: ReturnType<typeof vi.fn> };

  const stoppedSessionRepo = {
    upsert: vi.fn(),
    clear: vi.fn(),
    findByVehicleId: vi.fn(),
    findStoppedInCriticalZone: vi.fn(),
  };

  function buildUseCase(zone: CriticalZone | null) {
    stoppedSessionRepo.findByVehicleId.mockResolvedValue(
      zone
        ? { stoppedSince: new Date(Date.now() - 25 * 60 * 1000), zoneId: zone.id }
        : null,
    );
    return new ProcessTelemetryUseCase(
      { save: vi.fn(), findByVehicleId: vi.fn(), refreshCurrentStateView: vi.fn() },
      alertRepo,
      { updateStatus: vi.fn(), findAll: vi.fn(), findById: vi.fn(), markStaleOffline: vi.fn() },
      stoppedSessionRepo,
      { resolveZone: vi.fn().mockResolvedValue(zone) } as unknown as ZoneEnrichmentService,
      { publish: vi.fn().mockResolvedValue(undefined) },
      wsGateway,
      new OpossumAdapter(),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    alertRepo = {
      save: vi.fn(),
      findActive: vi.fn(),
      hasActiveAlert: vi.fn().mockResolvedValue(false),
    };
    wsGateway = { emitVehicleUpdate: vi.fn(), emitAlert: vi.fn(), emitVehicleOffline: vi.fn() };
    useCase = buildUseCase(criticalZone);
  });

  it('creates speeding alert when speed exceeds limit', async () => {
    useCase = buildUseCase(null);

    const result = await useCase.execute({
      eventId: 'e-speed',
      ...basePayload,
      speedKmh: SPEED_LIMIT_KMH + 15,
    });

    expect(result.alerts.some((a) => a.type === 'speeding')).toBe(true);
    expect(alertRepo.save).toHaveBeenCalled();
    expect(wsGateway.emitAlert).toHaveBeenCalled();
    expect(stoppedSessionRepo.clear).toHaveBeenCalled();
  });

  it('creates fuel alert when level is below threshold', async () => {
    useCase = buildUseCase(null);

    const result = await useCase.execute({
      eventId: 'e-fuel',
      ...basePayload,
      speedKmh: 40,
      fuelLevel: FUEL_LOW_THRESHOLD - 5,
    });

    expect(result.alerts.some((a) => a.type === 'fuel')).toBe(true);
    expect(alertRepo.save).toHaveBeenCalled();
    expect(wsGateway.emitAlert).toHaveBeenCalled();
  });

  it('creates critical_zone alert when stopped 20+ min in critical zone', async () => {
    const result = await useCase.execute({
      eventId: 'e1',
      ...basePayload,
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
      ...basePayload,
      speedKmh: 0,
    });

    expect(alertRepo.hasActiveAlert).toHaveBeenCalledWith(
      expect.anything(),
      'critical_zone',
    );
    expect(alertRepo.save).not.toHaveBeenCalled();
  });
});
