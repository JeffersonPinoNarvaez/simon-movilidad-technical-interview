import CircuitBreaker from 'opossum';
import type { ICircuitBreakerRegistry } from '../../application/ports/index.js';

/** Service boundary identifiers simulating microservice communication paths. */
export const CB_SERVICE_BOUNDARIES = {
  INGEST_TO_BROKER: 'svc:ingest→broker',
  PROCESSOR_TO_PERSISTENCE: 'svc:processor→persistence',
  PROCESSOR_TO_REALTIME: 'svc:processor→realtime',
  AGENT_TO_LLM: 'svc:agent→llm',
  AGENT_TO_DATA: 'svc:agent→data',
  API_TO_CACHE: 'svc:api→cache',
} as const;

const CB_DB_THRESHOLD = 50;
const CB_DB_TIMEOUT_MS = 3000;
const CB_DB_RESET_MS = 30000;
const CB_AI_THRESHOLD = 60;
const CB_AI_TIMEOUT_MS = 10000;
const CB_KAFKA_THRESHOLD = 40;
const CB_KAFKA_TIMEOUT_MS = 2000;
const CB_REDIS_THRESHOLD = 50;
const CB_REDIS_TIMEOUT_MS = 2000;
const CB_REALTIME_THRESHOLD = 50;
const CB_REALTIME_TIMEOUT_MS = 3000;

/**
 * OpossumAdapter — circuit breaker registry per .cursorrules.
 * Protects infrastructure calls and logical service boundaries.
 */
export class OpossumAdapter implements ICircuitBreakerRegistry {
  private readonly breakers: Map<string, CircuitBreaker> = new Map();

  wrap<T extends unknown[], R>(
    name: string,
    fn: (...args: T) => Promise<R>,
    options: { timeout: number; errorThresholdPercentage: number; resetTimeout?: number },
  ): (...args: T) => Promise<R> {
    const breaker = new CircuitBreaker(fn, {
      timeout: options.timeout,
      errorThresholdPercentage: options.errorThresholdPercentage,
      resetTimeout: options.resetTimeout ?? CB_DB_RESET_MS,
    });
    this.breakers.set(name, breaker);
    return (...args: T) => breaker.fire(...args);
  }

  getStates(): Record<string, { state: string; service: string; stats: Record<string, unknown> }> {
    const states: Record<string, { state: string; service: string; stats: Record<string, unknown> }> =
      {};
    for (const [name, breaker] of this.breakers) {
      states[name] = {
        state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
        service: name.startsWith('svc:') ? name : 'infrastructure',
        stats: {
          failures: breaker.stats.failures,
          successes: breaker.stats.successes,
          rejects: breaker.stats.rejects,
          timeouts: breaker.stats.timeouts,
        },
      };
    }
    return states;
  }

  static dbOptions() {
    return {
      timeout: CB_DB_TIMEOUT_MS,
      errorThresholdPercentage: CB_DB_THRESHOLD,
      resetTimeout: CB_DB_RESET_MS,
    };
  }

  static aiOptions() {
    return {
      timeout: CB_AI_TIMEOUT_MS,
      errorThresholdPercentage: CB_AI_THRESHOLD,
    };
  }

  static kafkaOptions() {
    return {
      timeout: CB_KAFKA_TIMEOUT_MS,
      errorThresholdPercentage: CB_KAFKA_THRESHOLD,
    };
  }

  static redisOptions() {
    return {
      timeout: CB_REDIS_TIMEOUT_MS,
      errorThresholdPercentage: CB_REDIS_THRESHOLD,
    };
  }

  static realtimeOptions() {
    return {
      timeout: CB_REALTIME_TIMEOUT_MS,
      errorThresholdPercentage: CB_REALTIME_THRESHOLD,
    };
  }
}

/** @deprecated Use OpossumAdapter — kept for backward compatibility during migration. */
export class CircuitBreakerService extends OpossumAdapter {}
