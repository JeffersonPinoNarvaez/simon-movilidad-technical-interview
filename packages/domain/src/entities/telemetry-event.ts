import { DeviceId, VehicleId } from '../value-objects/ids.js';
import { Coordinates, Speed } from '../value-objects/coordinates.js';

export type TelemetryStatus = 'active' | 'stopped' | 'alert';

export interface TelemetryEventProps {
  time: Date;
  deviceId: DeviceId;
  vehicleId: VehicleId;
  coordinates: Coordinates;
  speed: Speed | null;
  heading: number | null;
  fuelLevel: number | null;
  status: TelemetryStatus;
  metadata: Record<string, unknown>;
}

export class TelemetryEvent {
  private constructor(private readonly props: TelemetryEventProps) {}

  static create(props: TelemetryEventProps): TelemetryEvent {
    return new TelemetryEvent(props);
  }

  get time(): Date {
    return this.props.time;
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }

  get vehicleId(): VehicleId {
    return this.props.vehicleId;
  }

  get coordinates(): Coordinates {
    return this.props.coordinates;
  }

  get speed(): Speed | null {
    return this.props.speed;
  }

  get heading(): number | null {
    return this.props.heading;
  }

  get fuelLevel(): number | null {
    return this.props.fuelLevel;
  }

  get status(): TelemetryStatus {
    return this.props.status;
  }

  get metadata(): Record<string, unknown> {
    return { ...this.props.metadata };
  }

  toJSON(): Record<string, unknown> {
    return {
      time: this.props.time.toISOString(),
      deviceId: this.props.deviceId.toString(),
      vehicleId: this.props.vehicleId.toString(),
      lat: this.props.coordinates.lat,
      lng: this.props.coordinates.lng,
      speedKmh: this.props.speed?.kmh ?? null,
      heading: this.props.heading,
      fuelLevel: this.props.fuelLevel,
      status: this.props.status,
      metadata: this.props.metadata,
    };
  }
}
