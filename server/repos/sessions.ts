import type { AppDatabase } from "../db.js";

export interface SessionRow {
  id: string;
  token_hash: string;
  created_at: number;
  expires_at: number;
}

export interface NewSessionRow {
  id: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
}

export interface ResolvedSession {
  sessionId: string;
  expiresAt: number;
}

export function insertSession(db: AppDatabase, session: NewSessionRow): void {
  db.prepare(
    `INSERT INTO admin_sessions (id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).run(session.id, session.tokenHash, session.createdAt, session.expiresAt);
}

export function findSessionByTokenHash(
  db: AppDatabase,
  tokenHash: string,
  now: number,
): ResolvedSession | undefined {
  const row = db
    .prepare(
      `SELECT id, expires_at
       FROM admin_sessions
       WHERE token_hash = ? AND expires_at > ?`,
    )
    .get(tokenHash, now) as Pick<SessionRow, "id" | "expires_at"> | undefined;

  if (!row) return undefined;

  return { sessionId: row.id, expiresAt: row.expires_at };
}

export function deleteSessionByTokenHash(db: AppDatabase, tokenHash: string): void {
  db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash);
}

export function deleteExpiredSessions(db: AppDatabase, now: number): void {
  db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(now);
}
