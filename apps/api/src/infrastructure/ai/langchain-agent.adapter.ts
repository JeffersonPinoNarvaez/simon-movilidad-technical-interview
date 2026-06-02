import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import pg from 'pg';
import type { IAgentService } from '../../application/ports/index.js';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service.js';
import type { Logger } from 'pino';

const DEFAULT_MODEL = 'gpt-4o-mini';
const MEMORY_WINDOW = 10;

const SYSTEM_PROMPT = `You are FleetPortal AI, an assistant for fleet monitoring operators in Colombia.
Answer questions about vehicle locations, speeds, alerts, and fleet status using the data provided.
Be factual, concise, and respond in the same language as the user.
If you don't have enough data, say so clearly.`;

interface SessionMemory {
  messages: Array<{ role: 'human' | 'ai'; content: string }>;
}

export class LangChainAgentAdapter implements IAgentService {
  private readonly sessions = new Map<string, SessionMemory>();
  private chatFn: ((message: string, sessionId: string) => Promise<string>) | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly modelName: string,
    private readonly pool: pg.Pool,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly logger: Logger,
  ) {}

  init(): void {
    this.chatFn = this.circuitBreaker.wrap(
      'ai-agent',
      (message: string, sessionId: string) => this.executeChat(message, sessionId),
      CircuitBreakerService.aiOptions(),
    );
  }

  async chat(message: string, sessionId: string): Promise<string> {
    if (!this.chatFn) this.init();
    return this.chatFn!(message, sessionId);
  }

  private async executeChat(message: string, sessionId: string): Promise<string> {
    const fleetContext = await this.buildFleetContext();
    const session = this.getSession(sessionId);
    session.messages.push({ role: 'human', content: message });
    this.trimMemory(session);

    const model = new ChatOpenAI({
      apiKey: this.apiKey,
      model: this.modelName || DEFAULT_MODEL,
      temperature: 0,
    });

    const history = session.messages.slice(0, -1).map((m) =>
      m.role === 'human' ? new HumanMessage(m.content) : new AIMessage(m.content),
    );

    const response = await model.invoke([
      new SystemMessage(`${SYSTEM_PROMPT}\n\nCurrent fleet data:\n${fleetContext}`),
      ...history,
      new HumanMessage(message),
    ]);

    const reply =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

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

  private async buildFleetContext(): Promise<string> {
    try {
      const [vehicles, alerts] = await Promise.all([
        this.pool.query(`
          SELECT v.plate, v.name, v.status, s.lat, s.lng, s.speed_kmh, s.last_update
          FROM vehicles v
          LEFT JOIN vehicle_current_state s ON v.id = s.vehicle_id
        `),
        this.pool.query(
          `SELECT a.type, a.message, a.severity, v.plate
           FROM alerts a JOIN vehicles v ON a.vehicle_id = v.id
           WHERE a.active = TRUE LIMIT 20`,
        ),
      ]);

      return JSON.stringify(
        { vehicles: vehicles.rows, activeAlerts: alerts.rows },
        null,
        2,
      );
    } catch (err) {
      this.logger.warn({ err }, 'Failed to build fleet context for agent');
      return 'Fleet data temporarily unavailable.';
    }
  }
}
