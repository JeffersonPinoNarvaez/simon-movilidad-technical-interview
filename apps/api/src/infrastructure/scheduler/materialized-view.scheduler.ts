import type { ITelemetryRepository } from '@fleet-portal/domain';
import { MATERIALIZED_VIEW_REFRESH_MS } from '@fleet-portal/shared';
import type { Logger } from 'pino';

export function startMaterializedViewRefresh(
  telemetryRepo: ITelemetryRepository,
  logger: Logger,
): NodeJS.Timeout {
  const tick = async () => {
    try {
      await telemetryRepo.refreshCurrentStateView();
      logger.debug('Refreshed vehicle_current_state materialized view');
    } catch (err) {
      logger.warn({ err }, 'Failed to refresh vehicle_current_state');
    }
  };

  void tick();
  return setInterval(tick, MATERIALIZED_VIEW_REFRESH_MS);
}
