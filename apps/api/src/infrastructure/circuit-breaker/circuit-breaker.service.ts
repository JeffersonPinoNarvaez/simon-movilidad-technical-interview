import CircuitBreaker from 'opossum';
import type { ICircuitBreakerRegistry } from '../../application/ports/index.js';

const CB_DB_THRESHOLD = 50;
const CB_DB_TIMEOUT_MS = 3000;
const CB_DB_RESET_MS = 30000;
const CB_AI_THRESHOLD = 60;
const CB_AI_TIMEOUT_MS = 10000;
const CB_KAFKA_THRESHOLD = 40;
const CB_KAFKA_TIMEOUT_MS = 2000;

export class CircuitBreakerService implements ICircuitBreakerRegistry {
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

  getStates(): Record<string, { state: string; stats: Record<string, unknown> }> {
    const states: Record<string, { state: string; stats: Record<string, unknown> }> = {};
    for (const [name, breaker] of this.breakers) {
      states[name] = {
        state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
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
}
