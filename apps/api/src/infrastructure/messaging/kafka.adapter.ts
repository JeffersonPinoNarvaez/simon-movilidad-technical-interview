import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import type { IMessageBroker } from '../../application/ports/index.js';
import type { Logger } from 'pino';
import {
  CB_SERVICE_BOUNDARIES,
  OpossumAdapter,
} from '../circuit-breaker/opossum.adapter.js';
import { Counter } from 'prom-client';

const kafkaProduceTotal = new Counter({
  name: 'kafka_produce_total',
  help: 'Total Kafka messages produced',
  labelNames: ['topic', 'status'] as const,
});

export class KafkaAdapter implements IMessageBroker {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private produceFn: ((topic: string, message: Record<string, unknown>) => Promise<void>) | null =
    null;

  constructor(
    private readonly brokers: string[],
    private readonly logger: Logger,
    private readonly circuitBreaker: OpossumAdapter,
  ) {
    this.kafka = new Kafka({
      clientId: 'fleet-portal-api',
      brokers: this.brokers,
      logLevel: logLevel.WARN,
    });
  }

  async connect(): Promise<void> {
    this.producer = this.kafka.producer();
    await this.producer.connect();

    this.produceFn = this.circuitBreaker.wrap(
      CB_SERVICE_BOUNDARIES.INGEST_TO_BROKER,
      async (topic: string, message: Record<string, unknown>) => {
        await this.producer!.send({
          topic,
          messages: [{ value: JSON.stringify(message) }],
        });
        kafkaProduceTotal.inc({ topic, status: 'success' });
      },
      OpossumAdapter.kafkaOptions(),
    );

    this.logger.info('Kafka producer connected');
  }

  async disconnect(): Promise<void> {
    await this.consumer?.disconnect();
    await this.producer?.disconnect();
  }

  async publish(topic: string, message: Record<string, unknown>): Promise<void> {
    if (!this.produceFn) throw new Error('Kafka not connected');
    try {
      await this.produceFn(topic, message);
    } catch (err) {
      kafkaProduceTotal.inc({ topic, status: 'error' });
      throw err;
    }
  }

  async subscribe(
    topic: string,
    groupId: string,
    handler: (message: Record<string, unknown>) => Promise<void>,
  ): Promise<void> {
    this.consumer = this.kafka.consumer({ groupId });
    await this.consumer.connect();
    await this.consumer.subscribe({ topic, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        const parsed = JSON.parse(message.value.toString()) as Record<string, unknown>;
        await handler(parsed);
      },
    });

    this.logger.info({ topic, groupId }, 'Kafka consumer subscribed');
  }
}

export { kafkaProduceTotal };
