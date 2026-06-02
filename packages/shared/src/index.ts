import { z } from 'zod';

export const DEDUP_TTL_SECONDS = 60;
export const DEDUP_BUCKET_MS = 5000;
export const TELEMETRY_TOPIC = 'telemetry.raw';
export const KAFKA_CONSUMER_GROUP = 'telemetry-processors';
export const SPEED_LIMIT_KMH = 80;
export const STOPPED_THRESHOLD_MINUTES = 5;
export const FUEL_LOW_THRESHOLD = 15;

export const telemetryIngestSchema = z.object({
  event_id: z.string().uuid(),
  device_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  timestamp: z.string().datetime({ offset: true }).or(z.string().datetime()),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed_kmh: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  fuel_level: z.number().min(0).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TelemetryIngestDto = z.infer<typeof telemetryIngestSchema>;

export const agentChatSchema = z.object({
  message: z.string().min(1).max(2000),
  session_id: z.string().uuid().optional(),
});

export type AgentChatDto = z.infer<typeof agentChatSchema>;

export interface VehicleUpdateEvent {
  vehicleId: string;
  deviceId: string;
  lat: number;
  lng: number;
  speedKmh: number | null;
  status: string;
  timestamp: string;
}

export interface AlertNewEvent {
  id: string;
  vehicleId: string;
  type: string;
  message: string;
  severity: string;
  createdAt: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

export function createProblemDetails(
  type: string,
  title: string,
  status: number,
  detail: string,
  instance: string,
): ProblemDetails {
  return { type, title, status, detail, instance };
}
