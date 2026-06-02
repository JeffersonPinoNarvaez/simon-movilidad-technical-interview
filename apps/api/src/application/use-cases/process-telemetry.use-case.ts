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
  CRITICAL_ZONE_STOPPED_MINUTES,
  STOPPED_SPEED_KMH,
  FUEL_LOW_THRESHOLD,
} from '@fleet-portal/shared';
import type {
  ITelemetryRepository,
  IAlertRepository,
  IVehicleRepository,
  IStoppedSessionRepository,
} from '@fleet-portal/domain';
import type { ICache, IWebSocketGateway, TelemetryRawMessage, EnrichmentResult } from '../ports/index.js';
import { ZoneEnrichmentService } from '../services/zone-enrichment.service.js';
import {
  OpossumAdapter,
  CB_SERVICE_BOUNDARIES,
} from '../../infrastructure/circuit-breaker/opossum.adapter.js';

export class ProcessTelemetryUseCase {
  private readonly publishRealtime: (channel: string, message: string) => Promise<void>;
  private readonly emitVehicleUpdate: (payload: Record<string, unknown>) => void;

  constructor(
    private readonly telemetryRepo: ITelemetryRepository,
    private readonly alertRepo: IAlertRepository,
    private readonly vehicleRepo: IVehicleRepository,
    private readonly stoppedSessionRepo: IStoppedSessionRepository,
    private readonly zoneEnrichment: ZoneEnrichmentService,
    private readonly cache: ICache,
    private readonly wsGateway: IWebSocketGateway,
    circuitBreaker: OpossumAdapter,
  ) {
    this.publishRealtime = circuitBreaker.wrap(
      CB_SERVICE_BOUNDARIES.PROCESSOR_TO_REALTIME,
      (channel: string, message: string) => this.cache.publish(channel, message),
      OpossumAdapter.realtimeOptions(),
    );
    this.emitVehicleUpdate = (payload) => this.wsGateway.emitVehicleUpdate(payload);
  }

  async execute(raw: TelemetryRawMessage): Promise<EnrichmentResult> {
    const time = new Date(raw.timestamp);
    const speed = raw.speedKmh != null ? Speed.create(raw.speedKmh) : null;
    const vehicleId = VehicleId.create(raw.vehicleId);
    const isStopped = speed?.isStopped(STOPPED_SPEED_KMH) ?? false;

    const criticalZone = await this.zoneEnrichment.resolveZone(raw.lat, raw.lng);
    const metadata = {
      ...(raw.metadata ?? {}),
      criticalZoneId: criticalZone?.id ?? null,
      criticalZoneName: criticalZone?.name ?? null,
    };

    let status: 'active' | 'stopped' | 'alert' = 'active';
    if (isStopped) {
      status = criticalZone ? 'alert' : 'stopped';
    }

    const event = TelemetryEvent.create({
      time,
      deviceId: DeviceId.create(raw.deviceId),
      vehicleId,
      coordinates: Coordinates.create(raw.lat, raw.lng),
      speed,
      heading: raw.heading ?? null,
      fuelLevel: raw.fuelLevel ?? null,
      status,
      metadata,
    });

    await this.telemetryRepo.save(event);
    await this.vehicleRepo.updateStatus(vehicleId, status, time);

    const alerts = await this.evaluateAlerts(event, vehicleId, isStopped, criticalZone);
    for (const alertData of alerts) {
      const alertType = alertData.type as Alert['type'];
      const alreadyActive = await this.alertRepo.hasActiveAlert(vehicleId, alertType);
      if (alreadyActive) continue;

      const alert = Alert.create({
        id: crypto.randomUUID(),
        vehicleId,
        type: alertData.type as Alert['type'],
        message: alertData.message,
        severity: alertData.severity as Alert['severity'],
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
      criticalZoneName: criticalZone?.name ?? null,
      timestamp: raw.timestamp,
    };

    await this.publishRealtime(
      `vehicle:${raw.vehicleId}:updates`,
      JSON.stringify(updatePayload),
    );
    this.emitVehicleUpdate(updatePayload);

    return { event, alerts };
  }

  private async evaluateAlerts(
    event: TelemetryEvent,
    vehicleId: VehicleId,
    isStopped: boolean,
    criticalZone: Awaited<ReturnType<ZoneEnrichmentService['resolveZone']>>,
  ): Promise<Array<{ type: string; message: string; severity: string }>> {
    const alerts: Array<{ type: string; message: string; severity: string }> = [];
    const vehicleIdStr = vehicleId.toString();

    if (event.speed?.isSpeeding(SPEED_LIMIT_KMH)) {
      alerts.push({
        type: 'speeding',
        message: `Vehicle exceeding ${SPEED_LIMIT_KMH} km/h (current: ${event.speed.kmh} km/h)`,
        severity: 'critical',
      });
    }

    if (isStopped) {
      const existing = await this.stoppedSessionRepo.findByVehicleId(vehicleIdStr);
      const stoppedSince = existing?.stoppedSince ?? event.time;

      await this.stoppedSessionRepo.upsert(
        vehicleIdStr,
        criticalZone?.id ?? null,
        stoppedSince,
        event.coordinates.lat,
        event.coordinates.lng,
      );

      const minutesStopped = (Date.now() - stoppedSince.getTime()) / 60000;

      if (criticalZone && minutesStopped >= CRITICAL_ZONE_STOPPED_MINUTES) {
        alerts.push({
          type: 'critical_zone',
          message: `Vehicle stopped ${Math.floor(minutesStopped)} min in critical zone "${criticalZone.name}" (threshold: ${CRITICAL_ZONE_STOPPED_MINUTES} min)`,
          severity: 'critical',
        });
      } else if (!criticalZone && minutesStopped >= STOPPED_THRESHOLD_MINUTES) {
        alerts.push({
          type: 'stopped',
          message: `Vehicle stopped for more than ${STOPPED_THRESHOLD_MINUTES} minutes`,
          severity: 'warning',
        });
      }
    } else {
      await this.stoppedSessionRepo.clear(vehicleIdStr);
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
