import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { IAgentService } from '../../application/ports/index.js';
import type { IAgentQueryPort } from '@fleet-portal/domain';
import {
  OpossumAdapter,
  CB_SERVICE_BOUNDARIES,
} from '../circuit-breaker/opossum.adapter.js';
import { createAgentTools } from './agent-tools.factory.js';
import type { Logger } from 'pino';

const DEFAULT_MODEL = 'gpt-4o-mini';
const MEMORY_WINDOW = 10;
const MAX_TOOL_ITERATIONS = 5;

const SYSTEM_PROMPT = `You are FleetPortal AI, an assistant for fleet monitoring operators in Colombia.
Use the available tools to answer questions about vehicle locations, speeds, alerts, stopped vehicles, and critical zones.
For questions like "vehicles stopped more than 20 minutes in critical zones", use query_vehicle_status with filter in_critical_zone.
Be factual, concise, and respond in the same language as the user.
If tools return no data, say so clearly.`;

interface SessionMemory {
  messages: Array<{ role: 'human' | 'ai'; content: string }>;
}

export class LangChainAgentAdapter implements IAgentService {
  private readonly sessions = new Map<string, SessionMemory>();
  private chatFn: ((message: string, sessionId: string) => Promise<string>) | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly modelName: string,
    private readonly agentQuery: IAgentQueryPort,
    private readonly circuitBreaker: OpossumAdapter,
    private readonly logger: Logger,
  ) {}

  init(): void {
    this.chatFn = this.circuitBreaker.wrap(
      CB_SERVICE_BOUNDARIES.AGENT_TO_LLM,
      (message: string, sessionId: string) => this.executeChat(message, sessionId),
      OpossumAdapter.aiOptions(),
    );
  }

  async chat(message: string, sessionId: string): Promise<string> {
    if (!this.chatFn) this.init();
    return this.chatFn!(message, sessionId);
  }

  private async executeChat(message: string, sessionId: string): Promise<string> {
    const session = this.getSession(sessionId);
    session.messages.push({ role: 'human', content: message });
    this.trimMemory(session);

    const tools = createAgentTools({
      queryVehicleStatus: (filter) =>
        this.circuitBreaker.wrap(
          CB_SERVICE_BOUNDARIES.AGENT_TO_DATA,
          () => this.agentQuery.queryVehicleStatus(filter),
          OpossumAdapter.dbOptions(),
        )(),
      queryTelemetryHistory: (vehicleId, hoursBack) =>
        this.circuitBreaker.wrap(
          CB_SERVICE_BOUNDARIES.AGENT_TO_DATA,
          () => this.agentQuery.queryTelemetryHistory(vehicleId, hoursBack),
          OpossumAdapter.dbOptions(),
        )(),
      getActiveAlerts: (type) =>
        this.circuitBreaker.wrap(
          CB_SERVICE_BOUNDARIES.AGENT_TO_DATA,
          () => this.agentQuery.getActiveAlerts(type),
          OpossumAdapter.dbOptions(),
        )(),
    });

    const model = new ChatOpenAI({
      apiKey: this.apiKey,
      model: this.modelName || DEFAULT_MODEL,
      temperature: 0,
    }).bindTools(tools);

    const history = session.messages.slice(0, -1).map((m) =>
      m.role === 'human' ? new HumanMessage(m.content) : new AIMessage(m.content),
    );

    let messages = [
      new SystemMessage(SYSTEM_PROMPT),
      ...history,
      new HumanMessage(message),
    ];

    let reply = '';
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await model.invoke(messages);
      const toolCalls = response.tool_calls ?? [];

      if (toolCalls.length === 0) {
        reply =
          typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);
        break;
      }

      messages = [...messages, response];

      for (const toolCall of toolCalls) {
        const tool = tools.find((t) => t.name === toolCall.name);
        const output = tool
          ? await tool.invoke(toolCall.args as Record<string, unknown>)
          : `Tool ${toolCall.name} not found`;
        messages.push(
          new ToolMessage({
            content: typeof output === 'string' ? output : JSON.stringify(output),
            tool_call_id: toolCall.id ?? toolCall.name,
          }),
        );
      }
    }

    if (!reply) {
      reply = 'No pude completar la consulta con las herramientas disponibles.';
    }

    session.messages.push({ role: 'ai', content: reply });
    return reply;
  }

  private getSession(sessionId: string): SessionMemory {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { messages: [] });
    }
    return this.sessions.get(sessionId)!;
  }

  private trimMemory(session: SessionMemory): void {
    if (session.messages.length > MEMORY_WINDOW * 2) {
      session.messages = session.messages.slice(-MEMORY_WINDOW * 2);
    }
  }
}
