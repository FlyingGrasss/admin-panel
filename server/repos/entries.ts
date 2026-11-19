import type { EntryData, EntryStatus } from "../../shared/types.js";
import type { AppDatabase } from "../db.js";

export interface EntryRow {
  id: string;
  collection_id: string;
  data_json: string;
  status: EntryStatus;
  created_at: number;
  updated_at: number;
}

export interface EntryRecord {
  id: string;
  collectionId: string;
  data: EntryData;
  status: EntryStatus;
  createdAt: number;
  updatedAt: number;
}

export interface EntryPage {
  entries: EntryRecord[];
  total: number;
}

export interface CollectionEntryCounts {
  collectionId: string;
  total: number;
  draft: number;
  published: number;
}

function parseData(json: string): EntryData {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("entries.data_json bir nesne değil.");
  }
  return parsed as EntryData;
}

export function toEntryRecord(row: EntryRow): EntryRecord {
  return {
    id: row.id,
    collectionId: row.collection_id,
    data: parseData(row.data_json),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function insertEntry(
  db: AppDatabase,
  entry: {
    id: string;
    collectionId: string;
    dataJson: string;
    status: EntryStatus;
    createdAt: number;
    updatedAt: number;
  },
): void {
  db.prepare(
    `INSERT INTO entries (id, collection_id, data_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.id,
    entry.collectionId,
    entry.dataJson,
    entry.status,
    entry.createdAt,
    entry.updatedAt,
  );
}

export function findEntryById(
  db: AppDatabase,
  id: string,
): EntryRecord | undefined {
  const row = db
    .prepare(
      `SELECT id, collection_id, data_json, status, created_at, updated_at
       FROM entries
       WHERE id = ?`,
    )
    .get(id) as EntryRow | undefined;

  return row ? toEntryRecord(row) : undefined;
}

export function updateEntry(
  db: AppDatabase,
  id: string,
  patch: { dataJson?: string; status?: EntryStatus; updatedAt: number },
): void {
  db.prepare(
    `UPDATE entries
     SET data_json = COALESCE(?, data_json),
         status = COALESCE(?, status),
         updated_at = ?
     WHERE id = ?`,
  ).run(patch.dataJson ?? null, patch.status ?? null, patch.updatedAt, id);
}

export function deleteEntry(db: AppDatabase, id: string): void {
  db.prepare("DELETE FROM entries WHERE id = ?").run(id);
}

export function listEntries(
  db: AppDatabase,
  collectionId: string,
  options: { status?: EntryStatus; limit: number; offset: number },
): EntryPage {
  const clauses = ["collection_id = ?"];
  const params: Array<string | number> = [collectionId];

  if (options.status) {
    clauses.push("status = ?");
    params.push(options.status);
  }

  const where = clauses.join(" AND ");

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS count FROM entries WHERE ${where}`)
    .get(...params) as { count: number };

  const rows = db
    .prepare(
      `SELECT id, collection_id, data_json, status, created_at, updated_at
       FROM entries
       WHERE ${where}
       ORDER BY updated_at DESC, created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit, options.offset) as EntryRow[];

  return { entries: rows.map(toEntryRecord), total: totalRow.count };
}

export function listPublishedEntries(
  db: AppDatabase,
  collectionId: string,
  options: { limit: number; offset: number },
): EntryRecord[] {
  const rows = db
    .prepare(
      `SELECT id, collection_id, data_json, status, created_at, updated_at
       FROM entries
       WHERE collection_id = ? AND status = 'published'
       ORDER BY updated_at DESC, created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(collectionId, options.limit, options.offset) as EntryRow[];

  return rows.map(toEntryRecord);
}

export function findPublishedEntry(
  db: AppDatabase,
  collectionId: string,
  id: string,
): EntryRecord | undefined {
  const row = db
    .prepare(
      `SELECT id, collection_id, data_json, status, created_at, updated_at
       FROM entries
       WHERE id = ? AND collection_id = ? AND status = 'published'`,
    )
    .get(id, collectionId) as EntryRow | undefined;

  return row ? toEntryRecord(row) : undefined;
}

export function entryCountsByCollection(
  db: AppDatabase,
): CollectionEntryCounts[] {
  const rows = db
    .prepare(
      `SELECT
         collection_id,
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
         SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published
       FROM entries
       GROUP BY collection_id`,
    )
    .all() as Array<{
    collection_id: string;
    total: number;
    draft: number;
    published: number;
  }>;

  return rows.map((row) => ({
    collectionId: row.collection_id,
    total: row.total,
    draft: row.draft,
    published: row.published,
  }));
}
