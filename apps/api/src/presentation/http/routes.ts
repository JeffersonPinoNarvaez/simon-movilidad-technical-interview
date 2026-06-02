import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { DomainError, ValidationError } from '@fleet-portal/domain';
import type { IngestTelemetryUseCase } from '../../application/use-cases/ingest-telemetry.use-case.js';
import type { ListVehiclesUseCase } from '../../application/use-cases/list-vehicles.use-case.js';
import type { GetActiveAlertsUseCase } from '../../application/use-cases/get-active-alerts.use-case.js';
import type { ChatWithAgentUseCase } from '../../application/use-cases/chat-with-agent.use-case.js';
import type { OpossumAdapter } from '../../infrastructure/circuit-breaker/opossum.adapter.js';
import { Registry } from 'prom-client';
import { Counter } from 'prom-client';
import { registerHealthRoutes } from './health.routes.js';
import { registerTelemetryRoutes } from './telemetry.routes.js';
import { registerVehicleRoutes } from './vehicles.routes.js';
import { registerAlertRoutes } from './alerts.routes.js';
import { registerAgentRoutes } from './agent.routes.js';
import { sendProblem } from './problem-details.js';

const dedupDroppedTotal = new Counter({
  name: 'dedup_dropped_total',
  help: 'Total deduplicated telemetry events dropped',
});

export interface RouteDependencies {
  ingestTelemetry: IngestTelemetryUseCase;
  listVehicles: ListVehiclesUseCase;
  getActiveAlerts: GetActiveAlertsUseCase;
  chatWithAgent: ChatWithAgentUseCase;
  circuitBreaker: OpossumAdapter;
  metricsRegistry: Registry;
}

export async function registerRoutes(
  app: FastifyInstance,
  deps: RouteDependencies,
): Promise<void> {
  app.addHook('onRequest', async (request) => {
    request.headers['x-request-id'] =
      (request.headers['x-request-id'] as string) ?? randomUUID();
  });

  await registerHealthRoutes(app, deps);
  await registerTelemetryRoutes(app, deps.ingestTelemetry);
  await registerVehicleRoutes(app, deps.listVehicles);
  await registerAlertRoutes(app, deps.getActiveAlerts);
  await registerAgentRoutes(app, deps.chatWithAgent);

  app.setErrorHandler((error, request, reply) => {
    const instance = request.url;

    if (error instanceof ValidationError) {
      return sendProblem(
        reply,
        422,
        'Validation Error',
        error.message,
        instance,
        'https://fleetportal.dev/errors/validation-error',
      );
    }

    if (error instanceof DomainError) {
      return sendProblem(reply, 400, 'Domain Error', error.message, instance);
    }

    request.log.error({ err: error }, 'Unhandled error');
    return sendProblem(reply, 500, 'Internal Server Error', 'An unexpected error occurred', instance);
  });
}

export { dedupDroppedTotal };
