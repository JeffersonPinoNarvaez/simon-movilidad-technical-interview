import { CriticalZone, findZoneForCoordinates } from '@fleet-portal/domain';
import type {
  ICriticalZoneRepository,
  IStoppedSessionRepository,
  IAgentQueryPort,
} from '@fleet-portal/domain';
import type { AlertType } from '@fleet-portal/domain';
import { CRITICAL_ZONE_STOPPED_MINUTES } from '@fleet-portal/shared';

const ALLOWED_STATUS_FILTERS = new Set([
  'all',
  'active',
  'stopped',
  'offline',
  'alert',
  'in_critical_zone',
]);

export class AgentQueryService implements IAgentQueryPort {
  constructor(
    private readonly zoneRepo: ICriticalZoneRepository,
    private readonly stoppedSessionRepo: IStoppedSessionRepository,
    private readonly pool: {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
    },
  ) {}

  async queryVehicleStatus(filter: string): Promise<unknown> {
    const normalized = filter.trim().toLowerCase();

    if (normalized.startsWith('plate:')) {
      const plate = filter.slice('plate:'.length).trim().toUpperCase();
      const result = await this.pool.query(
        `SELECT v.plate, v.name, v.status, s.lat, s.lng, s.speed_kmh, s.last_update
         FROM vehicles v
         LEFT JOIN vehicle_current_state s ON v.id = s.vehicle_id
         WHERE UPPER(v.plate) = $1`,
        [plate],
      );
      return result.rows;
    }

    if (!ALLOWED_STATUS_FILTERS.has(normalized)) {
      return {
        error: `Invalid filter "${filter}". Allowed: ${[...ALLOWED_STATUS_FILTERS].join(', ')}, plate:ABC-123`,
      };
    }

    if (normalized === 'in_critical_zone') {
      return this.stoppedSessionRepo.findStoppedInCriticalZone(CRITICAL_ZONE_STOPPED_MINUTES);
    }

    const result =
      normalized === 'all'
        ? await this.pool.query(
            `SELECT v.plate, v.name, v.status, s.lat, s.lng, s.speed_kmh, s.last_update
             FROM vehicles v
             LEFT JOIN vehicle_current_state s ON v.id = s.vehicle_id
             ORDER BY v.plate`,
          )
        : await this.pool.query(
            `SELECT v.plate, v.name, v.status, s.lat, s.lng, s.speed_kmh, s.last_update
             FROM vehicles v
             LEFT JOIN vehicle_current_state s ON v.id = s.vehicle_id
             WHERE v.status = $1
             ORDER BY v.plate`,
            [normalized],
          );

    const zones = await this.loadZones();
    return result.rows.map((row) => ({
      ...row,
      criticalZone:
        row.lat != null && row.lng != null
          ? (findZoneForCoordinates(
              zones,
              row.lat as number,
              row.lng as number,
            )?.name ?? null)
          : null,
    }));
  }

  async queryTelemetryHistory(
    vehicleId: string | undefined,
    hoursBack: number,
  ): Promise<unknown> {
    const hours = Math.min(Math.max(hoursBack, 1), 72);

    const result = vehicleId
      ? await this.pool.query(
          `SELECT time_bucket('5 minutes', time) AS bucket,
                  vehicle_id, AVG(lat) AS lat, AVG(lng) AS lng, AVG(speed_kmh) AS speed_kmh
           FROM telemetry_events
           WHERE vehicle_id = $1 AND time > NOW() - INTERVAL '1 hour' * $2
           GROUP BY bucket, vehicle_id
           ORDER BY bucket DESC
           LIMIT 500`,
          [vehicleId, hours],
        )
      : await this.pool.query(
          `SELECT time_bucket('5 minutes', time) AS bucket,
                  COUNT(DISTINCT vehicle_id) AS vehicle_count, AVG(speed_kmh) AS avg_speed
           FROM telemetry_events
           WHERE time > NOW() - INTERVAL '1 hour' * $1
           GROUP BY bucket
           ORDER BY bucket DESC
           LIMIT 500`,
          [hours],
        );

    return result.rows;
  }

  async getActiveAlerts(type: AlertType | 'all'): Promise<unknown> {
    const result =
      type === 'all'
        ? await this.pool.query(
            `SELECT a.type, a.message, a.severity, a.created_at, v.plate
             FROM alerts a JOIN vehicles v ON a.vehicle_id = v.id
             WHERE a.active = TRUE ORDER BY a.created_at DESC LIMIT 50`,
          )
        : await this.pool.query(
            `SELECT a.type, a.message, a.severity, a.created_at, v.plate
             FROM alerts a JOIN vehicles v ON a.vehicle_id = v.id
             WHERE a.active = TRUE AND a.type = $1 ORDER BY a.created_at DESC LIMIT 50`,
            [type],
          );

    return result.rows;
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
