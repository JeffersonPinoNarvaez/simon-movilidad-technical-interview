import type { FastifyInstance } from 'fastify';
import { telemetryIngestSchema, createProblemDetails } from '@fleet-portal/shared';
import { DuplicateEventError } from '@fleet-portal/domain';
import type { IngestTelemetryUseCase } from '../../application/use-cases/ingest-telemetry.use-case.js';
import { sendProblem } from './problem-details.js';
import { dedupDroppedTotal } from './routes.js';

export async function registerTelemetryRoutes(
  app: FastifyInstance,
  ingestTelemetry: IngestTelemetryUseCase,
): Promise<void> {
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
      const result = await ingestTelemetry.execute({ dto: parsed.data });
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
}
