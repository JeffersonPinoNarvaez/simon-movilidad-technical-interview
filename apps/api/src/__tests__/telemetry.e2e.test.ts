import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from '../presentation/http/routes.js';
import type { IngestTelemetryUseCase } from '../application/use-cases/ingest-telemetry.use-case.js';
import type { ListVehiclesUseCase } from '../application/use-cases/list-vehicles.use-case.js';
import type { GetActiveAlertsUseCase } from '../application/use-cases/get-active-alerts.use-case.js';
import type { ChatWithAgentUseCase } from '../application/use-cases/chat-with-agent.use-case.js';
import { Registry } from 'prom-client';
import { OpossumAdapter } from '../infrastructure/circuit-breaker/opossum.adapter.js';

describe('Telemetry API e2e', () => {
  let app: ReturnType<typeof Fastify>;

  const ingestTelemetry = {
    execute: vi.fn().mockResolvedValue({ accepted: true, eventId: 'test-event' }),
  };
  const listVehicles = { execute: vi.fn().mockResolvedValue([]) };
  const getActiveAlerts = { execute: vi.fn().mockResolvedValue([]) };
  const chatWithAgent = {
    execute: vi.fn().mockResolvedValue({ reply: 'ok', sessionId: 'session-1' }),
  };

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cors, { origin: true });
    await registerRoutes(app, {
      ingestTelemetry: ingestTelemetry as unknown as IngestTelemetryUseCase,
      listVehicles: listVehicles as unknown as ListVehiclesUseCase,
      getActiveAlerts: getActiveAlerts as unknown as GetActiveAlertsUseCase,
      chatWithAgent: chatWithAgent as unknown as ChatWithAgentUseCase,
      circuitBreaker: new OpossumAdapter(),
      metricsRegistry: new Registry(),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('POST /telemetry validates payload (RFC 7807)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/telemetry',
      payload: { lat: 999 },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({
      title: 'Validation Error',
      status: 422,
    });
  });

  it('POST /telemetry accepts valid event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/telemetry',
      payload: {
        event_id: 'b0000000-0000-4000-8000-000000000001',
        device_id: 'c0000000-0000-4000-8000-000000000001',
        vehicle_id: 'a0000000-0000-4000-8000-000000000001',
        timestamp: '2025-05-29T12:00:00Z',
        lat: 4.6097,
        lng: -74.0817,
        speed_kmh: 0,
      },
    });
    expect(res.statusCode).toBe(202);
    expect(ingestTelemetry.execute).toHaveBeenCalled();
  });

  it('GET /health/circuit-breakers exposes service boundaries', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/circuit-breakers' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('circuitBreakers');
  });
});
