import http from 'k6/http';
import { check, sleep } from 'k6';

const API_URL = __ENV.API_URL || 'http://localhost:3001';

/** 409 = dedup window (expected under concurrent load); default k6 only counts 2xx as success */
const telemetryExpected = http.expectedStatuses(202, 409);

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.1'],
  },
};

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const VEHICLE_IDS = [
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003',
];

export default function () {
  const vehicleId = VEHICLE_IDS[Math.floor(Math.random() * VEHICLE_IDS.length)];
  const deviceId = vehicleId.replace(/^a000/, 'c000');

  const res = http.post(
    `${API_URL}/telemetry`,
    JSON.stringify({
      event_id: uuidv4(),
      device_id: deviceId,
      vehicle_id: vehicleId,
      timestamp: new Date().toISOString(),
      lat: 4.6 + Math.random() * 0.05,
      lng: -74.08 + Math.random() * 0.05,
      speed_kmh: 30 + Math.floor(Math.random() * 40),
    }),
    { headers: { 'Content-Type': 'application/json' }, responseCallback: telemetryExpected },
  );

  check(res, {
    'accepted or dedup': (r) => r.status === 202 || r.status === 409,
  });

  sleep(0.5);
}

export function setup() {
  const health = http.get(`${API_URL}/health`);
  check(health, { 'api healthy': (r) => r.status === 200 });
}
