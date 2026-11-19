import type { CollectionField } from "../../shared/types.js";
import type { AppDatabase } from "../db.js";

export interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  fields_json: string;
  created_at: number;
  updated_at: number;
}

export interface CollectionRecord {
  id: string;
  name: string;
  slug: string;
  fields: CollectionField[];
  createdAt: number;
  updatedAt: number;
}

function parseFields(json: string): CollectionField[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error("collections.fields_json bir dizi değil.");
  }
  return parsed as CollectionField[];
}

function toRecord(row: CollectionRow): CollectionRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    fields: parseFields(row.fields_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listCollections(db: AppDatabase): CollectionRecord[] {
  const rows = db
    .prepare(
      `SELECT id, name, slug, fields_json, created_at, updated_at
       FROM collections
       ORDER BY created_at ASC, name COLLATE NOCASE ASC, id ASC`,
    )
    .all() as CollectionRow[];

  return rows.map(toRecord);
}

export function findCollectionById(
  db: AppDatabase,
  id: string,
): CollectionRecord | undefined {
  const row = db
    .prepare(
      `SELECT id, name, slug, fields_json, created_at, updated_at
       FROM collections
       WHERE id = ?`,
    )
    .get(id) as CollectionRow | undefined;

  return row ? toRecord(row) : undefined;
}

export function findCollectionBySlug(
  db: AppDatabase,
  slug: string,
): CollectionRecord | undefined {
  const row = db
    .prepare(
      `SELECT id, name, slug, fields_json, created_at, updated_at
       FROM collections
       WHERE slug = ?`,
    )
    .get(slug) as CollectionRow | undefined;

  return row ? toRecord(row) : undefined;
}

export function insertCollection(
  db: AppDatabase,
  collection: {
    id: string;
    name: string;
    slug: string;
    fieldsJson: string;
    createdAt: number;
    updatedAt: number;
  },
): void {
  db.prepare(
    `INSERT INTO collections (id, name, slug, fields_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    collection.id,
    collection.name,
    collection.slug,
    collection.fieldsJson,
    collection.createdAt,
    collection.updatedAt,
  );
}

export function updateCollection(
  db: AppDatabase,
  id: string,
  patch: { name?: string; fieldsJson?: string; updatedAt: number },
): void {
  db.prepare(
    `UPDATE collections
     SET name = COALESCE(?, name),
         fields_json = COALESCE(?, fields_json),
         updated_at = ?
     WHERE id = ?`,
  ).run(patch.name ?? null, patch.fieldsJson ?? null, patch.updatedAt, id);
}

export function deleteCollection(db: AppDatabase, id: string): void {
  db.prepare("DELETE FROM collections WHERE id = ?").run(id);
}
