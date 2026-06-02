import type { FastifyReply } from 'fastify';
import { createProblemDetails } from '@fleet-portal/shared';

export function sendProblem(
  reply: FastifyReply,
  status: number,
  title: string,
  detail: string,
  instance: string,
  type = 'https://fleetportal.dev/errors/general',
) {
  return reply.status(status).send(createProblemDetails(type, title, status, detail, instance));
}
