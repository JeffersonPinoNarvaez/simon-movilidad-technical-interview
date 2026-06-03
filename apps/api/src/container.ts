import { createContainer, asClass, asValue, InjectionMode } from 'awilix';
import pino from 'pino';
import { Registry } from 'prom-client';
import { KAFKA_CONSUMER_GROUP, TELEMETRY_TOPIC } from '@fleet-portal/shared';

import { OpossumAdapter } from './infrastructure/circuit-breaker/opossum.adapter.js';
import { RedisAdapter } from './infrastructure/cache/redis.adapter.js';
import { KafkaAdapter } from './infrastructure/messaging/kafka.adapter.js';
import {
  createPool,
  TimescaleDeviceRepository,
  TimescaleVehicleRepository,
  TimescaleTelemetryRepository,
  TimescaleAlertRepository,
  TimescaleCriticalZoneRepository,
  TimescaleStoppedSessionRepository,
} from './infrastructure/persistence/timescale.repository.js';
import { runVehicleOfflineCheck } from './infrastructure/scheduler/vehicle-offline.scheduler.js';
import { VEHICLE_OFFLINE_CHECK_MS, VEHICLE_OFFLINE_THRESHOLD_MS } from '@fleet-portal/shared';
import { LangChainAgentAdapter } from './infrastructure/ai/langchain-agent.adapter.js';
import { SocketIoGateway } from './infrastructure/ws/socket-io.gateway.js';

import { IngestTelemetryUseCase } from './application/use-cases/ingest-telemetry.use-case.js';
import { ProcessTelemetryUseCase } from './application/use-cases/process-telemetry.use-case.js';
import { ListVehiclesUseCase } from './application/use-cases/list-vehicles.use-case.js';
import { GetActiveAlertsUseCase } from './application/use-cases/get-active-alerts.use-case.js';
import { ChatWithAgentUseCase } from './application/use-cases/chat-with-agent.use-case.js';
import { AgentQueryService } from './application/services/agent-query.service.js';
import { ZoneEnrichmentService } from './application/services/zone-enrichment.service.js';
import type { TelemetryRawMessage } from './application/ports/index.js';
import { dedupDroppedTotal } from './presentation/http/routes.js';

export interface AppConfig {
  databaseUrl: string;
  redisUrl: string;
  kafkaBrokers: string[];
  openaiApiKey: string;
  openaiModel: string;
  logLevel: string;
  nodeEnv: string;
}

export function buildContainer(config: AppConfig) {
  const logger = pino({
    level: config.logLevel,
    transport:
      config.nodeEnv === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });

  const pool = createPool(config.databaseUrl, logger);
  const circuitBreaker = new OpossumAdapter();
  const metricsRegistry = new Registry();
  metricsRegistry.registerMetric(dedupDroppedTotal);

  const container = createContainer({ injectionMode: InjectionMode.CLASSIC });

  container.register({
    logger: asValue(logger),
    config: asValue(config),
    pool: asValue(pool),
    circuitBreaker: asValue(circuitBreaker),
    metricsRegistry: asValue(metricsRegistry),
    redisUrl: asValue(config.redisUrl),
    brokers: asValue(config.kafkaBrokers),
    apiKey: asValue(config.openaiApiKey),
    modelName: asValue(config.openaiModel),
    cache: asClass(RedisAdapter).singleton(),
    messageBroker: asClass(KafkaAdapter).singleton(),
    wsGateway: asClass(SocketIoGateway).singleton(),
    deviceRepo: asClass(TimescaleDeviceRepository).singleton(),
    vehicleRepo: asClass(TimescaleVehicleRepository).singleton(),
    telemetryRepo: asClass(TimescaleTelemetryRepository).singleton(),
    alertRepo: asClass(TimescaleAlertRepository).singleton(),
    zoneRepo: asClass(TimescaleCriticalZoneRepository).singleton(),
    stoppedSessionRepo: asClass(TimescaleStoppedSessionRepository).singleton(),
    agentQuery: asClass(AgentQueryService).singleton(),
    zoneEnrichment: asClass(ZoneEnrichmentService).singleton(),
    agentService: asClass(LangChainAgentAdapter).singleton(),
    ingestTelemetry: asClass(IngestTelemetryUseCase).singleton(),
    processTelemetry: asClass(ProcessTelemetryUseCase).singleton(),
    listVehicles: asClass(ListVehiclesUseCase).singleton(),
    getActiveAlerts: asClass(GetActiveAlertsUseCase).singleton(),
    chatWithAgent: asClass(ChatWithAgentUseCase).singleton(),
  });

  return container;
}

export async function startTelemetryConsumer(container: ReturnType<typeof buildContainer>) {
  const messageBroker = container.resolve<KafkaAdapter>('messageBroker');
  const processTelemetry = container.resolve<ProcessTelemetryUseCase>('processTelemetry');
  const vehicleRepo = container.resolve<TimescaleVehicleRepository>('vehicleRepo');
  const wsGateway = container.resolve<SocketIoGateway>('wsGateway');
  const logger = container.resolve<pino.Logger>('logger');

  let lastOfflineCheck = 0;

  await messageBroker.subscribe(
    TELEMETRY_TOPIC,
    KAFKA_CONSUMER_GROUP,
    async (message) => {
      await processTelemetry.execute(message as unknown as TelemetryRawMessage);

      const now = Date.now();
      if (now - lastOfflineCheck >= VEHICLE_OFFLINE_CHECK_MS) {
        lastOfflineCheck = now;
        await runVehicleOfflineCheck(
          vehicleRepo,
          wsGateway,
          logger,
          VEHICLE_OFFLINE_THRESHOLD_MS,
        );
      }
    },
  );

  logger.info('Telemetry consumer started (includes throttled vehicle:offline checks)');
}

export async function connectInfrastructure(container: ReturnType<typeof buildContainer>) {
  const cache = container.resolve<RedisAdapter>('cache');
  const messageBroker = container.resolve<KafkaAdapter>('messageBroker');
  const agentService = container.resolve<LangChainAgentAdapter>('agentService');
  const config = container.resolve<AppConfig>('config');

  await cache.connect();
  await messageBroker.connect();
  agentService.init();

  if (!config.openaiApiKey || config.openaiApiKey.includes('your_openai')) {
    container.resolve<pino.Logger>('logger').warn('OPENAI_API_KEY not configured — agent will fail on requests');
  }
}
