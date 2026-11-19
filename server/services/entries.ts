import type {
  EntryDto,
  PublicEntryDto,
} from "../../shared/types.js";
import {
  parseEntryStatus,
  parsePagination,
  parseStatusFilter,
  validateEntryData,
} from "../../shared/validation.js";
import {
  ADMIN_ENTRY_PAGE_DEFAULT_LIMIT,
  ADMIN_ENTRY_PAGE_MAX_LIMIT,
  PUBLIC_ENTRY_PAGE_DEFAULT_LIMIT,
  PUBLIC_ENTRY_PAGE_MAX_LIMIT,
} from "../constants.js";
import type { AppDatabase } from "../db.js";
import { notFound } from "../errors.js";
import { newId } from "../ids.js";
import {
  findCollectionById,
  findCollectionBySlug,
  type CollectionRecord,
} from "../repos/collections.js";
import {
  deleteEntry,
  findEntryById,
  findPublishedEntry,
  insertEntry,
  listEntries,
  listPublishedEntries,
  updateEntry,
  type EntryRecord,
} from "../repos/entries.js";
import { unwrap } from "../validation.js";
import type { EntryListResponse } from "../../shared/types.js";

export function toEntryDto(entry: EntryRecord): EntryDto {
  return {
    id: entry.id,
    collectionId: entry.collectionId,
    data: entry.data,
    status: entry.status,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function toPublicEntryDto(entry: EntryRecord): PublicEntryDto {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    data: entry.data,
  };
}

export class EntryService {
  constructor(private readonly db: AppDatabase) {}

  listAdmin(
    collectionId: string,
    query: { status?: unknown; limit?: unknown; offset?: unknown },
  ): EntryListResponse {
    this.requireCollection(collectionId);

    const status = unwrap(parseStatusFilter(query.status));
    const { limit, offset } = unwrap(
      parsePagination(
        { limit: query.limit, offset: query.offset },
        ADMIN_ENTRY_PAGE_DEFAULT_LIMIT,
        ADMIN_ENTRY_PAGE_MAX_LIMIT,
      ),
    );

    const page = listEntries(this.db, collectionId, { status, limit, offset });

    return {
      entries: page.entries.map(toEntryDto),
      total: page.total,
    };
  }

  create(
    collectionId: string,
    input: { data?: unknown; status?: unknown },
  ): EntryDto {
    const collection = this.requireCollection(collectionId);
    const status =
      input.status === undefined ? "draft" : unwrap(parseEntryStatus(input.status));
    const data = unwrap(validateEntryData(collection.fields, input.data));

    const now = Date.now();
    const entry: EntryRecord = {
      id: newId(),
      collectionId,
      data,
      status,
      createdAt: now,
      updatedAt: now,
    };

    insertEntry(this.db, {
      id: entry.id,
      collectionId,
      dataJson: JSON.stringify(data),
      status,
      createdAt: now,
      updatedAt: now,
    });

    return toEntryDto(entry);
  }

  update(id: string, input: { data?: unknown; status?: unknown }): EntryDto {
    const existing = findEntryById(this.db, id);
    if (!existing) throw notFound("Kayıt bulunamadı.");

    const status =
      input.status === undefined ? existing.status : unwrap(parseEntryStatus(input.status));

    let data = existing.data;
    if (input.data !== undefined) {
      const collection = this.requireCollection(existing.collectionId);

      if (
        typeof input.data !== "object" ||
        input.data === null ||
        Array.isArray(input.data)
      ) {
        data = unwrap(validateEntryData(collection.fields, input.data));
      } else {
        // PATCH merges provided keys into the stored data. Keys removed from the
        // collection schema are dropped before validation.
        const merged: Record<string, unknown> = Object.create(null) as Record<
          string,
          unknown
        >;
        for (const field of collection.fields) {
          if (field.key in existing.data) {
            merged[field.key] = existing.data[field.key];
          }
        }
        Object.assign(merged, input.data);
        data = unwrap(validateEntryData(collection.fields, merged));
      }
    }

    if (input.data === undefined && input.status === undefined) {
      return toEntryDto(existing);
    }

    const updatedAt = Date.now();
    updateEntry(this.db, id, {
      ...(input.data !== undefined ? { dataJson: JSON.stringify(data) } : {}),
      ...(input.status !== undefined ? { status } : {}),
      updatedAt,
    });

    return {
      id: existing.id,
      collectionId: existing.collectionId,
      data,
      status,
      createdAt: existing.createdAt,
      updatedAt,
    };
  }

  delete(id: string): void {
    const existing = findEntryById(this.db, id);
    if (!existing) throw notFound("Kayıt bulunamadı.");
    deleteEntry(this.db, id);
  }

  listPublic(
    collectionSlug: string,
    query: { limit?: unknown; offset?: unknown },
  ): PublicEntryDto[] {
    const collection = findCollectionBySlug(this.db, collectionSlug);
    if (!collection) throw notFound("Koleksiyon bulunamadı.");

    const { limit, offset } = unwrap(
      parsePagination(
        { limit: query.limit, offset: query.offset },
        PUBLIC_ENTRY_PAGE_DEFAULT_LIMIT,
        PUBLIC_ENTRY_PAGE_MAX_LIMIT,
      ),
    );

    return listPublishedEntries(this.db, collection.id, { limit, offset }).map(
      toPublicEntryDto,
    );
  }

  getPublic(collectionSlug: string, id: string): PublicEntryDto {
    const collection = findCollectionBySlug(this.db, collectionSlug);
    if (!collection) throw notFound("Koleksiyon bulunamadı.");

    const entry = findPublishedEntry(this.db, collection.id, id);
    if (!entry) throw notFound("İçerik bulunamadı.");

    return toPublicEntryDto(entry);
  }

  private requireCollection(id: string): CollectionRecord {
    const collection = findCollectionById(this.db, id);
    if (!collection) throw notFound("Koleksiyon bulunamadı.");
    return collection;
  }
}
