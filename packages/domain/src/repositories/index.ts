import { Vehicle } from '../entities/vehicle.js';
import { TelemetryEvent } from '../entities/telemetry-event.js';
import { Alert, AlertType } from '../entities/alert.js';
import { VehicleId } from '../value-objects/ids.js';

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
