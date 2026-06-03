import { describe, it, expect } from 'vitest';
import { deviceIdForVehicle } from '@fleet-portal/shared';

describe('dashboard API client', () => {
  it('maps vehicle id to paired device id (a000 → c000)', () => {
    expect(deviceIdForVehicle('a0000000-0000-4000-8000-000000000002')).toBe(
      'c0000000-0000-4000-8000-000000000002',
    );
  });
});
