-- Limpia datos de runtime; conserva schema, vehículos seed y zonas críticas.
TRUNCATE TABLE telemetry_events;
TRUNCATE TABLE alerts RESTART IDENTITY CASCADE;
TRUNCATE TABLE vehicle_stopped_sessions;

UPDATE vehicles SET
  status = 'offline',
  last_seen = NULL,
  metadata = '{}'::jsonb;

REFRESH MATERIALIZED VIEW vehicle_current_state;
