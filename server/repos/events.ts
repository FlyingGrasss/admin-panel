import type { AppDatabase } from "../db.js";

export function insertApiEvent(
  db: AppDatabase,
  event: {
    method: string;
    path: string;
    status: number;
    durationMs: number;
    createdAt: number;
  },
): void {
  db.prepare(
    `INSERT INTO api_events (method, path, status, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(event.method, event.path, event.status, event.durationMs, event.createdAt);
}

export function countApiEventsSince(db: AppDatabase, since: number): number {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM api_events WHERE created_at >= ?")
    .get(since) as { count: number };

  return row.count;
}
