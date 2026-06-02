import {
  DeviceId,
  VehicleId,
  Coordinates,
  Speed,
  TelemetryEvent,
  Alert,
} from '@fleet-portal/domain';
import {
  SPEED_LIMIT_KMH,
  STOPPED_THRESHOLD_MINUTES,
  FUEL_LOW_THRESHOLD,
} from '@fleet-portal/shared';
import type { ITelemetryRepository, IAlertRepository, IVehicleRepository } from '@fleet-portal/domain';
import type { ICache, IWebSocketGateway, TelemetryRawMessage, EnrichmentResult } from '../ports/index.js';

const STOPPED_SPEED_KMH = 5;

export class ProcessTelemetryUseCase {
  constructor(
    private readonly telemetryRepo: ITelemetryRepository,
    private readonly alertRepo: IAlertRepository,
    private readonly vehicleRepo: IVehicleRepository,
    private readonly cache: ICache,
    private readonly wsGateway: IWebSocketGateway,
  ) {}

  async execute(raw: TelemetryRawMessage): Promise<EnrichmentResult> {
    const time = new Date(raw.timestamp);
    const speed = raw.speedKmh != null ? Speed.create(raw.speedKmh) : null;

    let status: 'active' | 'stopped' | 'alert' = 'active';
    if (speed?.isStopped(STOPPED_SPEED_KMH)) {
      status = 'stopped';
    }

    const event = TelemetryEvent.create({
      time,
      deviceId: DeviceId.create(raw.deviceId),
      vehicleId: VehicleId.create(raw.vehicleId),
      coordinates: Coordinates.create(raw.lat, raw.lng),
      speed,
      heading: raw.heading ?? null,
      fuelLevel: raw.fuelLevel ?? null,
      status,
      metadata: raw.metadata ?? {},
    });

    await this.telemetryRepo.save(event);

    const vehicleId = VehicleId.create(raw.vehicleId);
    await this.vehicleRepo.updateStatus(vehicleId, status, time);

    const alerts = await this.evaluateAlerts(event);
    for (const alertData of alerts) {
      const alert = Alert.create({
        id: crypto.randomUUID(),
        vehicleId,
        type: alertData.type as 'stopped' | 'speeding' | 'fuel',
        message: alertData.message,
        severity: alertData.severity as 'info' | 'warning' | 'critical',
        active: true,
        createdAt: new Date(),
        resolvedAt: null,
      });
      await this.alertRepo.save(alert);
      this.wsGateway.emitAlert(alert.toJSON());
    }

    const updatePayload = {
      vehicleId: raw.vehicleId,
      deviceId: raw.deviceId,
      lat: raw.lat,
      lng: raw.lng,
      speedKmh: raw.speedKmh ?? null,
      status,
      timestamp: raw.timestamp,
    };

    await this.cache.publish(
      `vehicle:${raw.vehicleId}:updates`,
      JSON.stringify(updatePayload),
    );

    this.wsGateway.emitVehicleUpdate(updatePayload);

    return { event, alerts };
  }

  private async evaluateAlerts(
    event: TelemetryEvent,
  ): Promise<Array<{ type: string; message: string; severity: string }>> {
    const alerts: Array<{ type: string; message: string; severity: string }> = [];

    if (event.speed?.isSpeeding(SPEED_LIMIT_KMH)) {
      alerts.push({
        type: 'speeding',
        message: `Vehicle exceeding ${SPEED_LIMIT_KMH} km/h (current: ${event.speed.kmh} km/h)`,
        severity: 'critical',
      });
    }

    if (event.speed?.isStopped(STOPPED_SPEED_KMH)) {
      alerts.push({
        type: 'stopped',
        message: `Vehicle stopped for more than ${STOPPED_THRESHOLD_MINUTES} minutes`,
        severity: 'warning',
      });
    }

    if (event.fuelLevel != null && event.fuelLevel < FUEL_LOW_THRESHOLD) {
      alerts.push({
        type: 'fuel',
        message: `Low fuel level: ${event.fuelLevel}%`,
        severity: 'warning',
      });
    }

    return alerts;
  }
}
