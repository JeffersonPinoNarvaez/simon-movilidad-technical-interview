import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  buildContainer,
  connectInfrastructure,
  startTelemetryConsumer,
  type AppConfig,
} from './container.js';
import { registerRoutes } from './presentation/http/routes.js';
import type { SocketIoGateway } from './infrastructure/ws/socket-io.gateway.js';

function loadConfig(): AppConfig {
  return {
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://fleet:fleet_secret@localhost:5432/fleetportal',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    nodeEnv: process.env.NODE_ENV ?? 'development',
  };
}

async function bootstrap() {
  const config = loadConfig();
  const container = buildContainer(config);
  const logger = container.resolve<{ info: (msg: string) => void; error: (obj: unknown, msg: string) => void }>('logger');

  await connectInfrastructure(container);
  await startTelemetryConsumer(container);

  const app = Fastify({
    logger: false,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(cors, { origin: true });

  await registerRoutes(app, {
    ingestTelemetry: container.resolve('ingestTelemetry'),
    listVehicles: container.resolve('listVehicles'),
    getActiveAlerts: container.resolve('getActiveAlerts'),
    chatWithAgent: container.resolve('chatWithAgent'),
    circuitBreaker: container.resolve('circuitBreaker'),
    metricsRegistry: container.resolve('metricsRegistry'),
  });

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen({ port, host: '0.0.0.0' });

  const wsGateway = container.resolve<SocketIoGateway>('wsGateway');
  wsGateway.attach(app.server);

  logger.info(`FleetPortal API listening on port ${port}`);

  const shutdown = async () => {
    logger.info('Shutting down...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
