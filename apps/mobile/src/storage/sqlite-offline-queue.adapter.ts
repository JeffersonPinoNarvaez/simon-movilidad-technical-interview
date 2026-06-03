/**
 * SQLite adapter for {@link IOfflineQueueRepository} (WatermelonDB-style offline queue).
 */
import type { IOfflineQueueRepository, PendingTelemetryRecord } from './offline-queue.port';
export { OFFLINE_BATCH_SIZE } from './offline-queue.port';
import {
  getDatabase,
  insertPendingEvent,
  getPendingCount,
  type PendingEvent,
} from '../services/StorageService';

async function fetchPendingBatch(batchSize: number): Promise<PendingTelemetryRecord[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<PendingEvent>(
    'SELECT * FROM pending_events ORDER BY created_at ASC LIMIT ?',
    [batchSize],
  );
  return rows;
}

async function markSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const database = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await database.runAsync(`DELETE FROM pending_events WHERE id IN (${placeholders})`, ids);
}

async function incrementRetry(ids: string[]): Promise<void> {
  const database = await getDatabase();
  for (const id of ids) {
    await database.runAsync(
      'UPDATE pending_events SET retry_count = retry_count + 1 WHERE id = ?',
      [id],
    );
  }
}

export const sqliteOfflineQueue: IOfflineQueueRepository = {
  insert: insertPendingEvent,
  getPendingCount,
  flushBatch: fetchPendingBatch,
  markSynced,
  incrementRetry,
};
