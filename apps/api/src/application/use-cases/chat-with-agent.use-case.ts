import type { IAgentService } from '../ports/index.js';

export class ChatWithAgentUseCase {
  constructor(private readonly agentService: IAgentService) {}

  async execute(message: string, sessionId: string): Promise<{ reply: string; sessionId: string }> {
    const reply = await this.agentService.chat(message, sessionId);
    return { reply, sessionId };
  }
}
