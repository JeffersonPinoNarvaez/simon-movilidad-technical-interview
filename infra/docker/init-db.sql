CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS vehicles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate       VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(100),
    driver_name VARCHAR(100),
    status      VARCHAR(20) DEFAULT 'offline',
    last_seen   TIMESTAMPTZ,
    metadata    JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS devices (
    id          UUID PRIMARY KEY,
    vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    label       VARCHAR(100),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (vehicle_id)
);

CREATE TABLE IF NOT EXISTS telemetry_events (
    time        TIMESTAMPTZ NOT NULL,
    device_id   UUID NOT NULL REFERENCES devices(id),
    vehicle_id  UUID NOT NULL REFERENCES vehicles(id),
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

CREATE TABLE IF NOT EXISTS critical_zones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    lat_min     DOUBLE PRECISION NOT NULL,
    lat_max     DOUBLE PRECISION NOT NULL,
    lng_min     DOUBLE PRECISION NOT NULL,
    lng_max     DOUBLE PRECISION NOT NULL,
    severity    VARCHAR(20) DEFAULT 'critical'
);

CREATE TABLE IF NOT EXISTS vehicle_stopped_sessions (
    vehicle_id    UUID PRIMARY KEY REFERENCES vehicles(id),
    zone_id       UUID REFERENCES critical_zones(id),
    stopped_since TIMESTAMPTZ NOT NULL,
    last_lat      DOUBLE PRECISION NOT NULL,
    last_lng      DOUBLE PRECISION NOT NULL
);

CREATE MATERIALIZED VIEW IF NOT EXISTS vehicle_current_state AS
SELECT DISTINCT ON (device_id)
    device_id, vehicle_id, lat, lng, speed_kmh, status, time AS last_update
FROM telemetry_events
ORDER BY device_id, time DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_current_state_device ON vehicle_current_state (device_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_current_state_vehicle ON vehicle_current_state (vehicle_id);

-- Catalog seed
INSERT INTO critical_zones (id, name, lat_min, lat_max, lng_min, lng_max, severity) VALUES
    ('d0000000-0000-4000-8000-000000000001', 'Bogotá Centro', 4.55, 4.68, -74.12, -74.05, 'critical'),
    ('d0000000-0000-4000-8000-000000000002', 'Zona Portuaria Cartagena', 10.35, 10.45, -75.55, -75.48, 'critical'),
    ('d0000000-0000-4000-8000-000000000003', 'Medellín Industrial', 6.20, 6.28, -75.62, -75.55, 'critical')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicles (id, plate, name, driver_name, status) VALUES
    ('a0000000-0000-4000-8000-000000000001', 'ABC-123', 'Camión Norte 1', 'Juan Pérez', 'offline'),
    ('a0000000-0000-4000-8000-000000000002', 'DEF-456', 'Van Sur 2', 'María Gómez', 'offline'),
    ('a0000000-0000-4000-8000-000000000003', 'GHI-789', 'Pickup Este 3', 'Carlos Ruiz', 'offline')
ON CONFLICT (plate) DO NOTHING;

INSERT INTO devices (id, vehicle_id, label) VALUES
    ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'GPS ABC-123'),
    ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'GPS DEF-456'),
    ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'GPS GHI-789')
ON CONFLICT (id) DO NOTHING;
