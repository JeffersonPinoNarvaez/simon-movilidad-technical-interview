import type { IVehicleRepository } from '@fleet-portal/domain';
import type { IWebSocketGateway } from '../../application/ports/index.js';
import { VEHICLE_OFFLINE_THRESHOLD_MS, VEHICLE_OFFLINE_CHECK_MS } from '@fleet-portal/shared';
import type { Logger } from 'pino';

export async function runVehicleOfflineCheck(
  vehicleRepo: IVehicleRepository,
  wsGateway: IWebSocketGateway,
  logger: Logger,
  inactivityMs: number = VEHICLE_OFFLINE_THRESHOLD_MS,
): Promise<void> {
  try {
    const vehicleIds = await vehicleRepo.markStaleOffline(inactivityMs);
    for (const vehicleId of vehicleIds) {
      wsGateway.emitVehicleOffline(vehicleId);
      logger.info({ vehicleId }, 'Vehicle marked offline (inactivity threshold exceeded)');
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to detect offline vehicles');
  }
}

export function startVehicleOfflineDetector(
  vehicleRepo: IVehicleRepository,
  wsGateway: IWebSocketGateway,
  logger: Logger,
  checkIntervalMs: number = VEHICLE_OFFLINE_CHECK_MS,
  inactivityMs: number = VEHICLE_OFFLINE_THRESHOLD_MS,
): NodeJS.Timeout {
  const tick = () => runVehicleOfflineCheck(vehicleRepo, wsGateway, logger, inactivityMs);

  void tick();
  return setInterval(tick, checkIntervalMs);
}
