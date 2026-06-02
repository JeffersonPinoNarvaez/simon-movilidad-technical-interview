import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { agentChatSchema } from '@fleet-portal/shared';
import type { ChatWithAgentUseCase } from '../../application/use-cases/chat-with-agent.use-case.js';
import { sendProblem } from './problem-details.js';

export async function registerAgentRoutes(
  app: FastifyInstance,
  chatWithAgent: ChatWithAgentUseCase,
): Promise<void> {
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
    const result = await chatWithAgent.execute(parsed.data.message, sessionId);
    return reply.send(result);
  });
}
