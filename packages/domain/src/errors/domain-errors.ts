export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class DuplicateEventError extends DomainError {
  constructor(deviceId: string) {
    super(`Duplicate telemetry event for device ${deviceId}`, 'DUPLICATE_EVENT');
    this.name = 'DuplicateEventError';
  }
}

export class InvalidDeviceError extends ValidationError {
  constructor(deviceId: string, vehicleId: string) {
    super(`Device ${deviceId} is not registered for vehicle ${vehicleId}`);
    this.name = 'InvalidDeviceError';
  }
}
