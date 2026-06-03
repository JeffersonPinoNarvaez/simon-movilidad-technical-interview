-- Sample telemetry + alerts for PDF/demo (re-apply after reset-demo --soft).
-- ABC-123 stays offline for mobile E2E; DEF-456 shows speeding + fuel; GHI-789 stopped in Bogotá.

INSERT INTO telemetry_events (time, device_id, vehicle_id, lat, lng, speed_kmh, fuel_level, status, metadata) VALUES
    (NOW() - INTERVAL '45 seconds', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
     4.6097, -74.0817, 95, 10, 'active', '{"source":"seed"}'),
    (NOW() - INTERVAL '2 minutes', 'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003',
     4.6105, -74.0820, 0, 50, 'stopped', '{"source":"seed","criticalZoneId":"d0000000-0000-4000-8000-000000000001"}');

UPDATE vehicles SET
    status = 'active',
    last_seen = NOW() - INTERVAL '45 seconds'
WHERE id = 'a0000000-0000-4000-8000-000000000002';

UPDATE vehicles SET
    status = 'stopped',
    last_seen = NOW() - INTERVAL '2 minutes'
WHERE id = 'a0000000-0000-4000-8000-000000000003';

INSERT INTO alerts (id, vehicle_id, type, message, severity, active) VALUES
    ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
     'speeding', 'Vehicle exceeding 80 km/h (current: 95 km/h)', 'critical', TRUE),
    ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
     'fuel', 'Low fuel level: 10%', 'warning', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicle_stopped_sessions (vehicle_id, zone_id, stopped_since, last_lat, last_lng) VALUES
    ('a0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001',
     NOW() - INTERVAL '25 minutes', 4.6105, -74.0820)
ON CONFLICT (vehicle_id) DO UPDATE SET
    zone_id = EXCLUDED.zone_id,
    stopped_since = EXCLUDED.stopped_since,
    last_lat = EXCLUDED.last_lat,
    last_lng = EXCLUDED.last_lng;

INSERT INTO alerts (id, vehicle_id, type, message, severity, active) VALUES
    ('f0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003',
     'critical_zone', 'Vehicle stopped 25 min in critical zone "Bogotá Centro" (threshold: 20 min)', 'critical', TRUE)
ON CONFLICT (id) DO NOTHING;

REFRESH MATERIALIZED VIEW vehicle_current_state;
