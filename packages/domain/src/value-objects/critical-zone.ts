import { ValidationError } from '../errors/domain-errors.js';

export interface ZoneBounds {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

export class CriticalZone {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly bounds: ZoneBounds,
    public readonly severity: string,
  ) {}

  static create(props: {
    id: string;
    name: string;
    bounds: ZoneBounds;
    severity?: string;
  }): CriticalZone {
    if (!props.name.trim()) {
      throw new ValidationError('Critical zone name is required');
    }
    return new CriticalZone(props.id, props.name, props.bounds, props.severity ?? 'critical');
  }

  contains(lat: number, lng: number): boolean {
    return (
      lat >= this.bounds.latMin &&
      lat <= this.bounds.latMax &&
      lng >= this.bounds.lngMin &&
      lng <= this.bounds.lngMax
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      bounds: this.bounds,
      severity: this.severity,
    };
  }
}

export function findZoneForCoordinates(
  zones: CriticalZone[],
  lat: number,
  lng: number,
): CriticalZone | null {
  return zones.find((zone) => zone.contains(lat, lng)) ?? null;
}
