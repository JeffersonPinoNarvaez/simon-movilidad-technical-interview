import { Redis, type Redis as RedisClient } from 'ioredis';
import { DEDUP_TTL_SECONDS, DEDUP_BUCKET_MS } from '@fleet-portal/shared';
import type { ICache } from '../../application/ports/index.js';
import type { Logger } from 'pino';

export class RedisAdapter implements ICache {
  private client: RedisClient | null = null;

  constructor(
    private readonly redisUrl: string,
    private readonly logger: Logger,
  ) {}

  async connect(): Promise<void> {
    this.client = new Redis(this.redisUrl, { maxRetriesPerRequest: 3 });
    this.client.on('error', (err: Error) => this.logger.error({ err }, 'Redis error'));
    await this.client.ping();
    this.logger.info('Redis connected');
  }

  async disconnect(): Promise<void> {
    await this.client?.quit();
    this.client = null;
  }

  private getClient(): RedisClient {
    if (!this.client) throw new Error('Redis not connected');
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.getClient().set(key, value, 'EX', ttlSeconds);
    } else {
      await this.getClient().set(key, value);
    }
  }

  async increment(key: string): Promise<number> {
    return this.getClient().incr(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.getClient().publish(channel, message);
  }

  async isDuplicate(deviceId: string, timestampMs: number): Promise<boolean> {
    const bucket = Math.floor(timestampMs / DEDUP_BUCKET_MS) * DEDUP_BUCKET_MS;
    const key = `dedup:${deviceId}:${bucket}`;
    const result = await this.getClient().set(key, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
    return result === null;
  }
}
