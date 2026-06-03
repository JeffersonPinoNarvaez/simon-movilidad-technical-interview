import {
  DeviceId,
  VehicleId,
  Coordinates,
  DuplicateEventError,
  InvalidDeviceError,
} from '@fleet-portal/domain';
import type { IDeviceRepository } from '@fleet-portal/domain';
import { DEDUP_BUCKET_MS, TELEMETRY_TOPIC } from '@fleet-portal/shared';
import type { ICache, IMessageBroker } from '../ports/index.js';
import type { TelemetryIngestDto } from '@fleet-portal/shared';

export interface IngestTelemetryInput {
  dto: TelemetryIngestDto;
}

export interface IngestTelemetryOutput {
  accepted: boolean;
  eventId: string;
  deduplicated?: boolean;
}

export class IngestTelemetryUseCase {
  constructor(
    private readonly cache: ICache,
    private readonly messageBroker: IMessageBroker,
    private readonly deviceRepo: IDeviceRepository,
  ) {}

  async execute(input: IngestTelemetryInput): Promise<IngestTelemetryOutput> {
    const { dto } = input;
    const timestampMs = new Date(dto.timestamp).getTime();

    const isDuplicate = await this.cache.isDuplicate(dto.device_id, timestampMs);
    if (isDuplicate) {
      await this.cache.increment('dedup:dropped');
      throw new DuplicateEventError(dto.device_id);
    }

    const deviceId = DeviceId.create(dto.device_id);
    const vehicleId = VehicleId.create(dto.vehicle_id);
    Coordinates.create(dto.lat, dto.lng);

    const device = await this.deviceRepo.findById(deviceId);
    if (!device || device.vehicleId !== vehicleId.toString()) {
      throw new InvalidDeviceError(dto.device_id, dto.vehicle_id);
    }

    await this.messageBroker.publish(TELEMETRY_TOPIC, {
      eventId: dto.event_id,
      deviceId: dto.device_id,
      vehicleId: dto.vehicle_id,
      timestamp: dto.timestamp,
      lat: dto.lat,
      lng: dto.lng,
      speedKmh: dto.speed_kmh,
      heading: dto.heading,
      fuelLevel: dto.fuel_level,
      metadata: dto.metadata ?? {},
    });

    return { accepted: true, eventId: dto.event_id };
  }

  static getTimestampBucket(timestampMs: number): number {
    return Math.floor(timestampMs / DEDUP_BUCKET_MS) * DEDUP_BUCKET_MS;
  }
}
