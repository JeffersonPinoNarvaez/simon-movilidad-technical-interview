import { VehicleId } from '../value-objects/ids.js';
import { Coordinates } from '../value-objects/coordinates.js';

export type VehicleStatus = 'active' | 'offline' | 'stopped' | 'alert';

export interface VehicleProps {
  id: VehicleId;
  plate: string;
  name: string | null;
  driverName: string | null;
  status: VehicleStatus;
  lastSeen: Date | null;
  coordinates: Coordinates | null;
}

export class Vehicle {
  private constructor(private readonly props: VehicleProps) {}

  static create(props: VehicleProps): Vehicle {
    if (!props.plate || props.plate.trim().length === 0) {
      throw new Error('Vehicle plate is required');
    }
    return new Vehicle(props);
  }

  get id(): VehicleId {
    return this.props.id;
  }

  get plate(): string {
    return this.props.plate;
  }

  get name(): string | null {
    return this.props.name;
  }

  get driverName(): string | null {
    return this.props.driverName;
  }

  get status(): VehicleStatus {
    return this.props.status;
  }

  get lastSeen(): Date | null {
    return this.props.lastSeen;
  }

  get coordinates(): Coordinates | null {
    return this.props.coordinates;
  }

  markOnline(coordinates: Coordinates, timestamp: Date): Vehicle {
    return Vehicle.create({
      ...this.props,
      status: 'active',
      coordinates,
      lastSeen: timestamp,
    });
  }

  markOffline(): Vehicle {
    return Vehicle.create({
      ...this.props,
      status: 'offline',
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.props.id.toString(),
      plate: this.props.plate,
      name: this.props.name,
      driverName: this.props.driverName,
      status: this.props.status,
      lastSeen: this.props.lastSeen?.toISOString() ?? null,
      coordinates: this.props.coordinates
        ? { lat: this.props.coordinates.lat, lng: this.props.coordinates.lng }
        : null,
    };
  }
}
