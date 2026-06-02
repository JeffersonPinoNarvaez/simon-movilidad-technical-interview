import { ValidationError } from '../errors/domain-errors.js';

export class VehicleId {
  private constructor(public readonly value: string) {}

  static create(value: string): VehicleId {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new ValidationError(`Invalid vehicle ID: ${value}`);
    }
    return new VehicleId(value);
  }

  equals(other: VehicleId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class DeviceId {
  private constructor(public readonly value: string) {}

  static create(value: string): DeviceId {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new ValidationError(`Invalid device ID: ${value}`);
    }
    return new DeviceId(value);
  }

  equals(other: DeviceId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
