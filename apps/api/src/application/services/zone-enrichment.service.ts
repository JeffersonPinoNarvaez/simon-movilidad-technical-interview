import { CriticalZone, findZoneForCoordinates } from '@fleet-portal/domain';
import type { ICriticalZoneRepository } from '@fleet-portal/domain';

export class ZoneEnrichmentService {
  constructor(private readonly zoneRepo: ICriticalZoneRepository) {}

  async resolveZone(lat: number, lng: number): Promise<CriticalZone | null> {
    const zones = await this.loadZones();
    return findZoneForCoordinates(zones, lat, lng);
  }

  private async loadZones(): Promise<CriticalZone[]> {
    const rows = await this.zoneRepo.findAll();
    return rows.map((row) =>
      CriticalZone.create({
        id: row.id,
        name: row.name,
        bounds: {
          latMin: row.latMin,
          latMax: row.latMax,
          lngMin: row.lngMin,
          lngMax: row.lngMax,
        },
        severity: row.severity,
      }),
    );
  }
}
