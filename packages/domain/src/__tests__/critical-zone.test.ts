import { describe, it, expect } from 'vitest';
import { CriticalZone, findZoneForCoordinates } from '../value-objects/critical-zone.js';

const bogotaCentro = CriticalZone.create({
  id: 'z001',
  name: 'Bogotá Centro',
  bounds: { latMin: 4.55, latMax: 4.68, lngMin: -74.12, lngMax: -74.05 },
});

describe('CriticalZone', () => {
  it('detects coordinates inside zone', () => {
    expect(bogotaCentro.contains(4.6097, -74.0817)).toBe(true);
  });

  it('detects coordinates outside zone', () => {
    expect(bogotaCentro.contains(3.45, -76.5)).toBe(false);
  });

  it('finds matching zone from list', () => {
    const zone = findZoneForCoordinates([bogotaCentro], 4.6, -74.08);
    expect(zone?.name).toBe('Bogotá Centro');
  });
});
