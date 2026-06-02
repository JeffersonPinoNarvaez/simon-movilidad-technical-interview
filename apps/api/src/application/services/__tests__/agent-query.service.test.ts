import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentQueryService } from '../agent-query.service.js';

describe('AgentQueryService', () => {
  const zoneRepo = {
    findAll: vi.fn().mockResolvedValue([
      {
        id: 'z1',
        name: 'Bogotá Centro',
        latMin: 4.55,
        latMax: 4.68,
        lngMin: -74.12,
        lngMax: -74.05,
        severity: 'critical',
      },
    ]),
  };

  const stoppedSessionRepo = {
    upsert: vi.fn(),
    clear: vi.fn(),
    findByVehicleId: vi.fn(),
    findStoppedInCriticalZone: vi.fn().mockResolvedValue([
      {
        vehicleId: 'v1',
        plate: 'ABC-123',
        zoneName: 'Bogotá Centro',
        stoppedSince: new Date(Date.now() - 25 * 60000),
        minutesStopped: 25,
        lat: 4.6,
        lng: -74.08,
      },
    ]),
  };

  const pool = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  };

  let service: AgentQueryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgentQueryService(zoneRepo, stoppedSessionRepo, pool);
  });

  it('rejects unsafe sql_filter values', async () => {
    const result = (await service.queryVehicleStatus('DROP TABLE users')) as { error: string };
    expect(result.error).toContain('Invalid filter');
  });

  it('queries vehicles in critical zones via safe filter', async () => {
    const result = await service.queryVehicleStatus('in_critical_zone');
    expect(stoppedSessionRepo.findStoppedInCriticalZone).toHaveBeenCalledWith(20);
    expect(result).toHaveLength(1);
  });

  it('queries telemetry history with hour cap', async () => {
    await service.queryTelemetryHistory('a0000000-0000-4000-8000-000000000001', 100);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('time_bucket'), [
      'a0000000-0000-4000-8000-000000000001',
      72,
    ]);
  });
});
