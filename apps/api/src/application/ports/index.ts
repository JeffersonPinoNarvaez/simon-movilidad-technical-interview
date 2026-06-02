import { TelemetryEvent } from '@fleet-portal/domain';

export interface IMessageBroker {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(topic: string, message: Record<string, unknown>): Promise<void>;
  subscribe(
    topic: string,
    groupId: string,
    handler: (message: Record<string, unknown>) => Promise<void>,
  ): Promise<void>;
}

export interface ICache {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  increment(key: string): Promise<number>;
  publish(channel: string, message: string): Promise<void>;
  isDuplicate(deviceId: string, timestampMs: number): Promise<boolean>;
}

export interface ICircuitBreakerRegistry {
  getStates(): Record<string, { state: string; stats: Record<string, unknown> }>;
}

export interface IWebSocketGateway {
  emitVehicleUpdate(payload: Record<string, unknown>): void;
  emitAlert(payload: Record<string, unknown>): void;
  emitVehicleOffline(vehicleId: string): void;
}

export interface IAgentService {
  chat(message: string, sessionId: string): Promise<string>;
}

export interface TelemetryRawMessage {
  eventId: string;
  deviceId: string;
  vehicleId: string;
  timestamp: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  heading?: number;
  fuelLevel?: number;
  metadata?: Record<string, unknown>;
}

export interface EnrichmentResult {
  event: TelemetryEvent;
  alerts: Array<{ type: string; message: string; severity: string }>;
}
