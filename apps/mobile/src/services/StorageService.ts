import * as SQLite from 'expo-sqlite';

const DB_NAME = 'fleetportal.db';
const BATCH_SIZE = 50;

export interface PendingEvent {
  id: string;
  payload: string;
  created_at: string;
  retry_count: number;
}

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pending_events (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0
      );
    `);
  }
  return db;
}

export async function insertPendingEvent(payload: Record<string, unknown>): Promise<void> {
  const database = await getDatabase();
  const id = crypto.randomUUID();
  await database.runAsync(
    'INSERT INTO pending_events (id, payload, created_at, retry_count) VALUES (?, ?, ?, 0)',
    [id, JSON.stringify(payload), new Date().toISOString()],
  );
}

export async function getPendingCount(): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM pending_events',
  );
  return row?.count ?? 0;
}

export async function flushPendingEvents(
  sendFn: (payload: Record<string, unknown>) => Promise<boolean>,
): Promise<number> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<PendingEvent>(
    'SELECT * FROM pending_events ORDER BY created_at ASC LIMIT ?',
    [BATCH_SIZE],
  );

  const syncedIds: string[] = [];

  for (const row of rows) {
    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    const success = await sendFn(payload);
    if (success) {
      syncedIds.push(row.id);
    } else {
      await database.runAsync(
        'UPDATE pending_events SET retry_count = retry_count + 1 WHERE id = ?',
        [row.id],
      );
      break;
    }
  }

  if (syncedIds.length > 0) {
    const placeholders = syncedIds.map(() => '?').join(',');
    await database.runAsync(
      `DELETE FROM pending_events WHERE id IN (${placeholders})`,
      syncedIds,
    );
  }

  return syncedIds.length;
}
