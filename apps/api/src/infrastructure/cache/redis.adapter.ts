import { Redis, type Redis as RedisClient } from 'ioredis';
import { DEDUP_TTL_SECONDS, DEDUP_BUCKET_MS } from '@fleet-portal/shared';
import type { ICache } from '../../application/ports/index.js';
import {
  OpossumAdapter,
  CB_SERVICE_BOUNDARIES,
} from '../circuit-breaker/opossum.adapter.js';
import type { Logger } from 'pino';

export class RedisAdapter implements ICache {
  private client: RedisClient | null = null;
  private guardedGet!: (key: string) => Promise<string | null>;
  private guardedSet!: (key: string, value: string, ttlSeconds?: number) => Promise<void>;
  private guardedIncrement!: (key: string) => Promise<number>;
  private guardedPublish!: (channel: string, message: string) => Promise<void>;
  private guardedIsDuplicate!: (deviceId: string, timestampMs: number) => Promise<boolean>;

  constructor(
    private readonly redisUrl: string,
    private readonly logger: Logger,
    private readonly circuitBreaker: OpossumAdapter,
  ) {}

  async connect(): Promise<void> {
    this.client = new Redis(this.redisUrl, { maxRetriesPerRequest: 3 });
    this.client.on('error', (err: Error) => this.logger.error({ err }, 'Redis error'));
    await this.client.ping();
    this.registerBreakers();
    this.logger.info('Redis connected');
  }

  private registerBreakers(): void {
    const options = OpossumAdapter.redisOptions();
    this.guardedGet = this.circuitBreaker.wrap(
      CB_SERVICE_BOUNDARIES.API_TO_CACHE,
      (key: string) => this.getClient().get(key),
      options,
    );
    this.guardedSet = this.circuitBreaker.wrap(
      CB_SERVICE_BOUNDARIES.API_TO_CACHE,
      (key: string, value: string, ttlSeconds?: number) => this.setDirect(key, value, ttlSeconds),
      options,
    );
    this.guardedIncrement = this.circuitBreaker.wrap(
      CB_SERVICE_BOUNDARIES.API_TO_CACHE,
      (key: string) => this.getClient().incr(key),
      options,
    );
    this.guardedPublish = this.circuitBreaker.wrap(
      CB_SERVICE_BOUNDARIES.API_TO_CACHE,
      async (channel: string, message: string) => {
        await this.getClient().publish(channel, message);
      },
      options,
    );
    this.guardedIsDuplicate = this.circuitBreaker.wrap(
      CB_SERVICE_BOUNDARIES.API_TO_CACHE,
      (deviceId: string, timestampMs: number) => this.isDuplicateDirect(deviceId, timestampMs),
      options,
    );
  }

  async disconnect(): Promise<void> {
    await this.client?.quit();
    this.client = null;
  }

  private getClient(): RedisClient {
    if (!this.client) throw new Error('Redis not connected');
    return this.client;
  }

  private async setDirect(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.getClient().set(key, value, 'EX', ttlSeconds);
    } else {
      await this.getClient().set(key, value);
    }
  }

  private async isDuplicateDirect(deviceId: string, timestampMs: number): Promise<boolean> {
    const bucket = Math.floor(timestampMs / DEDUP_BUCKET_MS) * DEDUP_BUCKET_MS;
    const key = `dedup:${deviceId}:${bucket}`;
    const result = await this.getClient().set(key, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
    return result === null;
  }

  async get(key: string): Promise<string | null> {
    return this.guardedGet(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.guardedSet(key, value, ttlSeconds);
  }

  async increment(key: string): Promise<number> {
    return this.guardedIncrement(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.guardedPublish(channel, message);
  }

  async isDuplicate(deviceId: string, timestampMs: number): Promise<boolean> {
    return this.guardedIsDuplicate(deviceId, timestampMs);
  }
}
