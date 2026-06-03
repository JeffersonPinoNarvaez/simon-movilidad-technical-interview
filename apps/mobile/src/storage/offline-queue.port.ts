/** Batch size for sync (PDF / .cursorrules). */
export const OFFLINE_BATCH_SIZE = 50;

/**
 * Offline queue port — WatermelonDB-compatible contract for the PDF spec.
 * Implementation uses expo-sqlite (Expo managed workflow) with the same semantics:
 * local persistence, batch sync (50), retry counter.
 */
export interface PendingTelemetryRecord {
  id: string;
  payload: string;
  created_at: string;
  retry_count: number;
}

export interface IOfflineQueueRepository {
  insert(payload: Record<string, unknown>): Promise<void>;
  getPendingCount(): Promise<number>;
  flushBatch(batchSize: number): Promise<PendingTelemetryRecord[]>;
  markSynced(ids: string[]): Promise<void>;
  incrementRetry(ids: string[]): Promise<void>;
}
