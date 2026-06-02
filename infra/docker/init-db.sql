CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS telemetry_events (
    time        TIMESTAMPTZ NOT NULL,
    device_id   UUID NOT NULL,
    vehicle_id  UUID NOT NULL,
    lat         DOUBLE PRECISION NOT NULL,
    lng         DOUBLE PRECISION NOT NULL,
    speed_kmh   FLOAT,
    heading     FLOAT,
    fuel_level  FLOAT,
    status      VARCHAR(20) DEFAULT 'active',
    metadata    JSONB DEFAULT '{}'
);

SELECT create_hypertable('telemetry_events', 'time', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry_events (device_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_time ON telemetry_events (vehicle_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_status_time ON telemetry_events (status, time DESC) WHERE status != 'active';

CREATE TABLE IF NOT EXISTS vehicles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate       VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(100),
    driver_name VARCHAR(100),
    status      VARCHAR(20) DEFAULT 'offline',
    last_seen   TIMESTAMPTZ,
    metadata    JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id  UUID NOT NULL REFERENCES vehicles(id),
    type        VARCHAR(20) NOT NULL,
    message     TEXT NOT NULL,
    severity    VARCHAR(10) DEFAULT 'warning',
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE MATERIALIZED VIEW IF NOT EXISTS vehicle_current_state AS
SELECT DISTINCT ON (device_id)
    device_id, vehicle_id, lat, lng, speed_kmh, status, time AS last_update
FROM telemetry_events
ORDER BY device_id, time DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_current_state_device ON vehicle_current_state (device_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_current_state_vehicle ON vehicle_current_state (vehicle_id);

INSERT INTO vehicles (id, plate, name, driver_name, status) VALUES
    ('a0000000-0000-4000-8000-000000000001', 'ABC-123', 'Camión Norte 1', 'Juan Pérez', 'offline'),
    ('a0000000-0000-4000-8000-000000000002', 'DEF-456', 'Van Sur 2', 'María Gómez', 'offline'),
    ('a0000000-0000-4000-8000-000000000003', 'GHI-789', 'Pickup Este 3', 'Carlos Ruiz', 'offline')
ON CONFLICT (plate) DO NOTHING;
