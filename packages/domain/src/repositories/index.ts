import { Vehicle } from '../entities/vehicle.js';
import { TelemetryEvent } from '../entities/telemetry-event.js';
import { Alert, AlertType } from '../entities/alert.js';
import { VehicleId } from '../value-objects/ids.js';

export interface ICriticalZoneRepository {
  findAll(): Promise<
    Array<{
      id: string;
      name: string;
      latMin: number;
      latMax: number;
      lngMin: number;
      lngMax: number;
      severity: string;
    }>
  >;
}

export interface IStoppedSessionRepository {
  upsert(
    vehicleId: string,
    zoneId: string | null,
    stoppedSince: Date,
    lat: number,
    lng: number,
  ): Promise<void>;
  clear(vehicleId: string): Promise<void>;
  findByVehicleId(vehicleId: string): Promise<{
    zoneId: string | null;
    stoppedSince: Date;
  } | null>;
  findStoppedInCriticalZone(minutes: number): Promise<
    Array<{
      vehicleId: string;
      plate: string;
      zoneName: string;
      stoppedSince: Date;
      minutesStopped: number;
      lat: number;
      lng: number;
    }>
  >;
}

export interface IAgentQueryPort {
  queryVehicleStatus(filter: string): Promise<unknown>;
  queryTelemetryHistory(vehicleId: string | undefined, hoursBack: number): Promise<unknown>;
  getActiveAlerts(type: AlertType | 'all'): Promise<unknown>;
}

export interface IVehicleRepository {
  findAll(): Promise<Vehicle[]>;
  findById(id: VehicleId): Promise<Vehicle | null>;
  updateStatus(id: VehicleId, status: string, lastSeen: Date): Promise<void>;
}

export interface ITelemetryRepository {
  save(event: TelemetryEvent): Promise<void>;
  findByVehicleId(vehicleId: VehicleId, hoursBack: number): Promise<TelemetryEvent[]>;
  refreshCurrentStateView(): Promise<void>;
}

export interface IAlertRepository {
  findActive(type?: AlertType | 'all'): Promise<Alert[]>;
  save(alert: Alert): Promise<void>;
}
