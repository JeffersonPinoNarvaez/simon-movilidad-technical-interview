import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 200 },
    { duration: '30s', target: 500 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:3001';

const telemetryAccepted = http.expectedStatuses(202, 409);
const telemetryInvalid = http.expectedStatuses(422);

const VEHICLE_IDS = [
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003',
];

const COLOMBIA_BOUNDS = {
  latMin: 4.0,
  latMax: 6.5,
  lngMin: -76.0,
  lngMax: -73.5,
};

function randomCoord(min, max) {
  return min + Math.random() * (max - min);
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function () {
  const roll = Math.random();
  const vehicleId = VEHICLE_IDS[randomIntBetween(0, VEHICLE_IDS.length - 1)];
  const deviceId = vehicleId.replace('a000', 'c000');
  const eventId = uuid();

  if (roll < 0.1) {
    const payload = JSON.stringify({
      event_id: eventId,
      device_id: deviceId,
      vehicle_id: vehicleId,
      timestamp: new Date().toISOString(),
      lat: randomCoord(COLOMBIA_BOUNDS.latMin, COLOMBIA_BOUNDS.latMax),
      lng: randomCoord(COLOMBIA_BOUNDS.lngMin, COLOMBIA_BOUNDS.lngMax),
      speed_kmh: randomIntBetween(0, 120),
    });

    http.post(`${API_URL}/telemetry`, payload, {
      headers: { 'Content-Type': 'application/json' },
      responseCallback: telemetryAccepted,
    });
    const dup = http.post(`${API_URL}/telemetry`, payload, {
      headers: { 'Content-Type': 'application/json' },
      responseCallback: telemetryAccepted,
    });
    check(dup, { 'duplicate rejected or accepted': (r) => r.status === 409 || r.status === 202 });
  } else if (roll < 0.15) {
    const res = http.post(
      `${API_URL}/telemetry`,
      JSON.stringify({
        event_id: eventId,
        device_id: deviceId,
        vehicle_id: vehicleId,
        timestamp: new Date().toISOString(),
        lat: 999,
        lng: -74,
      }),
      { headers: { 'Content-Type': 'application/json' }, responseCallback: telemetryInvalid },
    );
    check(res, { 'invalid payload rejected': (r) => r.status === 422 });
  } else {
    const res = http.post(
      `${API_URL}/telemetry`,
      JSON.stringify({
        event_id: eventId,
        device_id: deviceId,
        vehicle_id: vehicleId,
        timestamp: new Date().toISOString(),
        lat: randomCoord(COLOMBIA_BOUNDS.latMin, COLOMBIA_BOUNDS.latMax),
        lng: randomCoord(COLOMBIA_BOUNDS.lngMin, COLOMBIA_BOUNDS.lngMax),
        speed_kmh: randomIntBetween(0, 120),
        heading: randomIntBetween(0, 360),
        fuel_level: randomIntBetween(10, 100),
      }),
      { headers: { 'Content-Type': 'application/json' }, responseCallback: http.expectedStatuses(202) },
    );
    check(res, {
      'telemetry accepted': (r) => r.status === 202,
      'response time OK': (r) => r.timings.duration < 500,
    });
  }

  sleep(0.5);
}
