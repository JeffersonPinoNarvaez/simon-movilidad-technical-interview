import pg from 'pg';
import {
  Vehicle,
  VehicleId,
  DeviceId,
  Coordinates,
  Speed,
  TelemetryEvent,
  Alert,
  AlertType,
} from '@fleet-portal/domain';
import type {
  IVehicleRepository,
  ITelemetryRepository,
  IAlertRepository,
  ICriticalZoneRepository,
  IStoppedSessionRepository,
} from '@fleet-portal/domain';
import { CircuitBreakerService, OpossumAdapter, CB_SERVICE_BOUNDARIES } from '../circuit-breaker/opossum.adapter.js';
import type { Logger } from 'pino';

const { Pool } = pg;

export class TimescaleVehicleRepository implements IVehicleRepository {
  constructor(
    private readonly pool: pg.Pool,
    private readonly circuitBreaker: OpossumAdapter,
  ) {}

  async findAll(): Promise<Vehicle[]> {
    const query = this.circuitBreaker.wrap(
      'db-vehicles-findAll',
      async () => {
        const result = await this.pool.query(`
          SELECT v.*, s.lat, s.lng, s.speed_kmh, s.last_update
          FROM vehicles v
          LEFT JOIN vehicle_current_state s ON v.id = s.vehicle_id
          ORDER BY v.plate
        `);
        return result.rows;
      },
      CircuitBreakerService.dbOptions(),
    );

    const rows = await query();
    return rows.map((row) => this.mapRow(row));
  }

  async findById(id: VehicleId): Promise<Vehicle | null> {
    const result = await this.pool.query('SELECT * FROM vehicles WHERE id = $1', [id.toString()]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async updateStatus(id: VehicleId, status: string, lastSeen: Date): Promise<void> {
    const update = this.circuitBreaker.wrap(
      'db-vehicles-updateStatus',
      async () => {
        await this.pool.query(
          'UPDATE vehicles SET status = $1, last_seen = $2 WHERE id = $3',
          [status, lastSeen, id.toString()],
        );
      },
      CircuitBreakerService.dbOptions(),
    );
    await update();
  }

  private mapRow(row: Record<string, unknown>): Vehicle {
    return Vehicle.create({
      id: VehicleId.create(row.id as string),
      plate: row.plate as string,
      name: (row.name as string) ?? null,
      driverName: (row.driver_name as string) ?? null,
      status: (row.status as Vehicle['status']) ?? 'offline',
      lastSeen: row.last_seen ? new Date(row.last_seen as string) : null,
      coordinates:
        row.lat != null && row.lng != null
          ? Coordinates.create(row.lat as number, row.lng as number)
          : null,
    });
  }
}

export class TimescaleTelemetryRepository implements ITelemetryRepository {
  constructor(
    private readonly pool: pg.Pool,
    private readonly circuitBreaker: OpossumAdapter,
  ) {}

  async save(event: TelemetryEvent): Promise<void> {
    const insert = this.circuitBreaker.wrap(
      CB_SERVICE_BOUNDARIES.PROCESSOR_TO_PERSISTENCE,
      async () => {
        await this.pool.query(
          `INSERT INTO telemetry_events
           (time, device_id, vehicle_id, lat, lng, speed_kmh, heading, fuel_level, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            event.time,
            event.deviceId.toString(),
            event.vehicleId.toString(),
            event.coordinates.lat,
            event.coordinates.lng,
            event.speed?.kmh ?? null,
            event.heading,
            event.fuelLevel,
            event.status,
            JSON.stringify(event.metadata),
          ],
        );
      },
      CircuitBreakerService.dbOptions(),
    );
    await insert();
  }

  async findByVehicleId(vehicleId: VehicleId, hoursBack: number): Promise<TelemetryEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM telemetry_events
       WHERE vehicle_id = $1 AND time > NOW() - INTERVAL '1 hour' * $2
       ORDER BY time DESC LIMIT 1000`,
      [vehicleId.toString(), hoursBack],
    );

    return result.rows.map((row) =>
      TelemetryEvent.create({
        time: new Date(row.time as string),
        deviceId: DeviceId.create(row.device_id as string),
        vehicleId: VehicleId.create(row.vehicle_id as string),
        coordinates: Coordinates.create(row.lat as number, row.lng as number),
        speed: row.speed_kmh != null ? Speed.create(row.speed_kmh as number) : null,
        heading: row.heading as number | null,
        fuelLevel: row.fuel_level as number | null,
        status: row.status as TelemetryEvent['status'],
        metadata: (row.metadata as Record<string, unknown>) ?? {},
      }),
    );
  }

  async refreshCurrentStateView(): Promise<void> {
    await this.pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY vehicle_current_state');
  }
}

export class TimescaleAlertRepository implements IAlertRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findActive(type: AlertType | 'all' = 'all'): Promise<Alert[]> {
    const query =
      type === 'all'
        ? `SELECT * FROM alerts WHERE active = TRUE ORDER BY created_at DESC`
        : `SELECT * FROM alerts WHERE active = TRUE AND type = $1 ORDER BY created_at DESC`;

    const result =
      type === 'all'
        ? await this.pool.query(query)
        : await this.pool.query(query, [type]);

    return result.rows.map((row) => this.mapRow(row));
  }

  async hasActiveAlert(vehicleId: VehicleId, type: AlertType): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT EXISTS(
         SELECT 1 FROM alerts WHERE vehicle_id = $1 AND type = $2 AND active = TRUE
       ) AS exists`,
      [vehicleId.toString(), type],
    );
    return Boolean(result.rows[0]?.exists);
  }

  async save(alert: Alert): Promise<void> {
    await this.pool.query(
      `INSERT INTO alerts (id, vehicle_id, type, message, severity, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        alert.id,
        alert.vehicleId.toString(),
        alert.type,
        alert.message,
        alert.severity,
        alert.active,
        alert.createdAt,
      ],
    );
  }

  private mapRow(row: Record<string, unknown>): Alert {
    return Alert.create({
      id: row.id as string,
      vehicleId: VehicleId.create(row.vehicle_id as string),
      type: row.type as AlertType,
      message: row.message as string,
      severity: row.severity as Alert['severity'],
      active: row.active as boolean,
      createdAt: new Date(row.created_at as string),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : null,
    });
  }
}

export function createPool(databaseUrl: string, logger: Logger): pg.Pool {
  const pool = new Pool({ connectionString: databaseUrl });
  pool.on('error', (err) => logger.error({ err }, 'PostgreSQL pool error'));
  return pool;
}

export class TimescaleCriticalZoneRepository implements ICriticalZoneRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findAll() {
    const result = await this.pool.query(
      `SELECT id, name, lat_min, lat_max, lng_min, lng_max, severity FROM critical_zones`,
    );
    return result.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      latMin: row.lat_min as number,
      latMax: row.lat_max as number,
      lngMin: row.lng_min as number,
      lngMax: row.lng_max as number,
      severity: row.severity as string,
    }));
  }
}

export class TimescaleStoppedSessionRepository implements IStoppedSessionRepository {
  constructor(private readonly pool: pg.Pool) {}

  async upsert(
    vehicleId: string,
    zoneId: string | null,
    stoppedSince: Date,
    lat: number,
    lng: number,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO vehicle_stopped_sessions (vehicle_id, zone_id, stopped_since, last_lat, last_lng)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (vehicle_id) DO UPDATE SET
         zone_id = EXCLUDED.zone_id,
         last_lat = EXCLUDED.last_lat,
         last_lng = EXCLUDED.last_lng`,
      [vehicleId, zoneId, stoppedSince, lat, lng],
    );
  }

  async clear(vehicleId: string): Promise<void> {
    await this.pool.query(`DELETE FROM vehicle_stopped_sessions WHERE vehicle_id = $1`, [vehicleId]);
  }

  async findByVehicleId(vehicleId: string) {
    const result = await this.pool.query(
      `SELECT zone_id, stopped_since FROM vehicle_stopped_sessions WHERE vehicle_id = $1`,
      [vehicleId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      zoneId: row.zone_id as string | null,
      stoppedSince: new Date(row.stopped_since as string),
    };
  }

  async findStoppedInCriticalZone(minutes: number) {
    const result = await this.pool.query(
      `SELECT vss.vehicle_id, v.plate, cz.name AS zone_name, vss.stopped_since,
              vss.last_lat, vss.last_lng,
              EXTRACT(EPOCH FROM (NOW() - vss.stopped_since)) / 60 AS minutes_stopped
       FROM vehicle_stopped_sessions vss
       JOIN vehicles v ON v.id = vss.vehicle_id
       JOIN critical_zones cz ON cz.id = vss.zone_id
       WHERE vss.zone_id IS NOT NULL
         AND EXTRACT(EPOCH FROM (NOW() - vss.stopped_since)) / 60 >= $1
       ORDER BY vss.stopped_since ASC`,
      [minutes],
    );

    return result.rows.map((row) => ({
      vehicleId: row.vehicle_id as string,
      plate: row.plate as string,
      zoneName: row.zone_name as string,
      stoppedSince: new Date(row.stopped_since as string),
      minutesStopped: Math.floor(row.minutes_stopped as number),
      lat: row.last_lat as number,
      lng: row.last_lng as number,
    }));
  }
}
