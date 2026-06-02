import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startMaterializedViewRefresh } from '../materialized-view.scheduler.js';
import { MATERIALIZED_VIEW_REFRESH_MS } from '@fleet-portal/shared';

describe('startMaterializedViewRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes view immediately and on interval', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const logger = { debug: vi.fn(), warn: vi.fn() };

    const handle = startMaterializedViewRefresh({ refreshCurrentStateView: refresh }, logger);

    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    vi.advanceTimersByTime(MATERIALIZED_VIEW_REFRESH_MS);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));

    clearInterval(handle);
  });

  it('logs warning when refresh fails', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('db down'));
    const logger = { debug: vi.fn(), warn: vi.fn() };

    startMaterializedViewRefresh({ refreshCurrentStateView: refresh }, logger);
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalled());
  });
});
