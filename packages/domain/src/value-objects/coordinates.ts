import { ValidationError } from '../errors/domain-errors.js';

const MIN_LAT = -90;
const MAX_LAT = 90;
const MIN_LNG = -180;
const MAX_LNG = 180;

export class Coordinates {
  private constructor(
    public readonly lat: number,
    public readonly lng: number,
  ) {}

  static create(lat: number, lng: number): Coordinates {
    if (lat < MIN_LAT || lat > MAX_LAT) {
      throw new ValidationError(`Latitude must be between ${MIN_LAT} and ${MAX_LAT}`);
    }
    if (lng < MIN_LNG || lng > MAX_LNG) {
      throw new ValidationError(`Longitude must be between ${MIN_LNG} and ${MAX_LNG}`);
    }
    return new Coordinates(lat, lng);
  }

  distanceTo(other: Coordinates): number {
    const R = 6371;
    const dLat = this.toRad(other.lat - this.lat);
    const dLng = this.toRad(other.lng - this.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(this.lat)) *
        Math.cos(this.toRad(other.lat)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}

export class Speed {
  private constructor(public readonly kmh: number) {}

  static create(kmh: number): Speed {
    if (kmh < 0) {
      throw new ValidationError('Speed cannot be negative');
    }
    return new Speed(kmh);
  }

  isStopped(thresholdKmh = 5): boolean {
    return this.kmh < thresholdKmh;
  }

  isSpeeding(limitKmh: number): boolean {
    return this.kmh > limitKmh;
  }
}
