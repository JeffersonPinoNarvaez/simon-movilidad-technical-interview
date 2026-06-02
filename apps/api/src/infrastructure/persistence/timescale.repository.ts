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
} from '@fleet-portal/domain';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service.js';
import type { Logger } from 'pino';

const { Pool } = pg;

export class TimescaleVehicleRepository implements IVehicleRepository {
  constructor(
    private readonly pool: pg.Pool,
    private readonly circuitBreaker: CircuitBreakerService,
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
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async save(event: TelemetryEvent): Promise<void> {
    const insert = this.circuitBreaker.wrap(
      'db-telemetry-save',
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
