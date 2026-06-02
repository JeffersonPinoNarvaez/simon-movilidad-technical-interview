import type { FastifyInstance } from 'fastify';
import type { Registry } from 'prom-client';
import { collectDefaultMetrics } from 'prom-client';
import type { OpossumAdapter } from '../../infrastructure/circuit-breaker/opossum.adapter.js';

export async function registerHealthRoutes(
  app: FastifyInstance,
  deps: { circuitBreaker: OpossumAdapter; metricsRegistry: Registry },
): Promise<void> {
  collectDefaultMetrics({ register: deps.metricsRegistry });

  app.get('/health', async () => ({ status: 'ok', service: 'fleet-portal-api' }));

  app.get('/health/circuit-breakers', async () => ({
    circuitBreakers: deps.circuitBreaker.getStates(),
  }));

  app.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', deps.metricsRegistry.contentType);
    return deps.metricsRegistry.metrics();
  });
}
