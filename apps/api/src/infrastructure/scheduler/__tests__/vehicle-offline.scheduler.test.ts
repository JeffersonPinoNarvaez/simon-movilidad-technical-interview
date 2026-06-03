import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startVehicleOfflineDetector } from '../vehicle-offline.scheduler.js';

describe('startVehicleOfflineDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks stale vehicles offline and emits vehicle:offline immediately', async () => {
    const markStaleOffline = vi.fn().mockResolvedValue([
      'a0000000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000003',
    ]);
    const emitVehicleOffline = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn() };

    const handle = startVehicleOfflineDetector(
      { markStaleOffline },
      { emitVehicleOffline },
      logger as never,
      60_000,
      120_000,
    );

    await vi.waitFor(() => expect(markStaleOffline).toHaveBeenCalledTimes(1));

    expect(markStaleOffline).toHaveBeenCalledWith(120_000);
    expect(emitVehicleOffline).toHaveBeenCalledTimes(2);
    expect(emitVehicleOffline).toHaveBeenCalledWith('a0000000-0000-4000-8000-000000000002');

    markStaleOffline.mockResolvedValue([]);
    vi.advanceTimersByTime(60_000);
    await vi.waitFor(() => expect(markStaleOffline).toHaveBeenCalledTimes(2));
    expect(emitVehicleOffline).toHaveBeenCalledTimes(2);

    clearInterval(handle);
  });

  it('does not emit when no vehicles became offline', async () => {
    const markStaleOffline = vi.fn().mockResolvedValue([]);
    const emitVehicleOffline = vi.fn();

    const handle = startVehicleOfflineDetector(
      { markStaleOffline },
      { emitVehicleOffline },
      { info: vi.fn(), warn: vi.fn() } as never,
      60_000,
      120_000,
    );

    await vi.waitFor(() => expect(markStaleOffline).toHaveBeenCalledTimes(1));
    expect(emitVehicleOffline).not.toHaveBeenCalled();
    clearInterval(handle);
  });
});
