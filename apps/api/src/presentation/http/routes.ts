import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { telemetryIngestSchema, agentChatSchema, createProblemDetails } from '@fleet-portal/shared';
import { DomainError, DuplicateEventError, ValidationError } from '@fleet-portal/domain';
import type { IngestTelemetryUseCase } from '../../application/use-cases/ingest-telemetry.use-case.js';
import type { ListVehiclesUseCase } from '../../application/use-cases/list-vehicles.use-case.js';
import type { GetActiveAlertsUseCase } from '../../application/use-cases/get-active-alerts.use-case.js';
import type { ChatWithAgentUseCase } from '../../application/use-cases/chat-with-agent.use-case.js';
import type { CircuitBreakerService } from '../../infrastructure/circuit-breaker/opossum.adapter.js';
import { randomUUID } from 'node:crypto';
import { Counter, Registry, collectDefaultMetrics } from 'prom-client';

const dedupDroppedTotal = new Counter({
  name: 'dedup_dropped_total',
  help: 'Total deduplicated telemetry events dropped',
});

export interface RouteDependencies {
  ingestTelemetry: IngestTelemetryUseCase;
  listVehicles: ListVehiclesUseCase;
  getActiveAlerts: GetActiveAlertsUseCase;
  chatWithAgent: ChatWithAgentUseCase;
  circuitBreaker: CircuitBreakerService;
  metricsRegistry: Registry;
}

function sendProblem(
  reply: FastifyReply,
  status: number,
  title: string,
  detail: string,
  instance: string,
  type = 'https://fleetportal.dev/errors/general',
) {
  return reply.status(status).send(createProblemDetails(type, title, status, detail, instance));
}

export async function registerRoutes(
  app: FastifyInstance,
  deps: RouteDependencies,
): Promise<void> {
  collectDefaultMetrics({ register: deps.metricsRegistry });

  app.addHook('onRequest', async (request) => {
    request.headers['x-request-id'] =
      (request.headers['x-request-id'] as string) ?? randomUUID();
  });

  app.get('/health', async () => ({ status: 'ok', service: 'fleet-portal-api' }));

  app.get('/health/circuit-breakers', async () => ({
    circuitBreakers: deps.circuitBreaker.getStates(),
  }));

  app.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', deps.metricsRegistry.contentType);
    return deps.metricsRegistry.metrics();
  });

  app.post('/telemetry', async (request, reply) => {
    const parsed = telemetryIngestSchema.safeParse(request.body);
    if (!parsed.success) {
      const detail = parsed.error.errors.map((e) => e.message).join('; ');
      return sendProblem(
        reply,
        422,
        'Validation Error',
        detail,
        '/telemetry',
        'https://fleetportal.dev/errors/validation-error',
      );
    }

    try {
      const result = await deps.ingestTelemetry.execute({ dto: parsed.data });
      return reply.status(202).send(result);
    } catch (err) {
      if (err instanceof DuplicateEventError) {
        dedupDroppedTotal.inc();
        return reply.status(409).send(
          createProblemDetails(
            'https://fleetportal.dev/errors/duplicate-event',
            'Duplicate Event',
            409,
            err.message,
            '/telemetry',
          ),
        );
      }
      throw err;
    }
  });

  app.get('/vehicles', async (_request, reply) => {
    const vehicles = await deps.listVehicles.execute();
    return reply.send({ data: vehicles });
  });

  app.get('/alerts', async (request, reply) => {
    const type = (request.query as { type?: string }).type ?? 'all';
    const alerts = await deps.getActiveAlerts.execute(
      type as 'stopped' | 'speeding' | 'fuel' | 'all',
    );
    return reply.send({ data: alerts });
  });

  app.post('/agent/chat', async (request, reply) => {
    const parsed = agentChatSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendProblem(
        reply,
        422,
        'Validation Error',
        parsed.error.errors.map((e) => e.message).join('; '),
        '/agent/chat',
        'https://fleetportal.dev/errors/validation-error',
      );
    }

    const sessionId = parsed.data.session_id ?? randomUUID();
    const result = await deps.chatWithAgent.execute(parsed.data.message, sessionId);
    return reply.send(result);
  });

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
