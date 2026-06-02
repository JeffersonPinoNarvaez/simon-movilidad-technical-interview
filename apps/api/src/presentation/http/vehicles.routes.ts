import type { FastifyInstance } from 'fastify';
import type { ListVehiclesUseCase } from '../../application/use-cases/list-vehicles.use-case.js';

export async function registerVehicleRoutes(
  app: FastifyInstance,
  listVehicles: ListVehiclesUseCase,
): Promise<void> {
  app.get('/vehicles', async (_request, reply) => {
    const vehicles = await listVehicles.execute();
    return reply.send({ data: vehicles });
  });
}
