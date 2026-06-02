import type { FastifyInstance } from 'fastify';
import type { AlertType } from '@fleet-portal/domain';
import type { GetActiveAlertsUseCase } from '../../application/use-cases/get-active-alerts.use-case.js';

export async function registerAlertRoutes(
  app: FastifyInstance,
  getActiveAlerts: GetActiveAlertsUseCase,
): Promise<void> {
  app.get('/alerts', async (request, reply) => {
    const type = (request.query as { type?: string }).type ?? 'all';
    const alerts = await getActiveAlerts.execute(type as AlertType | 'all');
    return reply.send({ data: alerts });
  });
}
