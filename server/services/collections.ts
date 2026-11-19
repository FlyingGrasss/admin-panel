import type { CollectionDto } from "../../shared/types.js";
import {
  validateCollectionName,
  validateCollectionSlug,
  validateFields,
} from "../../shared/validation.js";
import type { AppDatabase } from "../db.js";
import { ApiError, isUniqueViolation, notFound } from "../errors.js";
import { newId } from "../ids.js";
import {
  deleteCollection,
  findCollectionById,
  findCollectionBySlug,
  insertCollection,
  listCollections,
  updateCollection,
  type CollectionRecord,
} from "../repos/collections.js";
import { unwrap } from "../validation.js";

export function toCollectionDto(collection: CollectionRecord): CollectionDto {
  return {
    id: collection.id,
    name: collection.name,
    slug: collection.slug,
    fields: collection.fields,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
}

export class CollectionService {
  constructor(private readonly db: AppDatabase) {}

  list(): CollectionDto[] {
    return listCollections(this.db).map(toCollectionDto);
  }

  getById(id: string): CollectionDto {
    return toCollectionDto(this.requireCollection(id));
  }

  create(input: {
    name?: unknown;
    slug?: unknown;
    fields?: unknown;
  }): CollectionDto {
    const name = unwrap(validateCollectionName(input.name));
    const slug = unwrap(validateCollectionSlug(input.slug));
    const fields = unwrap(validateFields(input.fields));

    if (findCollectionBySlug(this.db, slug)) {
      throw new ApiError(409, "SLUG_TAKEN", "Bu slug zaten kullanılıyor.");
    }

    const now = Date.now();
    const id = newId();

    try {
      insertCollection(this.db, {
        id,
        name,
        slug,
        fieldsJson: JSON.stringify(fields),
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiError(409, "SLUG_TAKEN", "Bu slug zaten kullanılıyor.");
      }
      throw error;
    }

    return {
      id,
      name,
      slug,
      fields,
      createdAt: now,
      updatedAt: now,
    };
  }

  update(
    id: string,
    input: { name?: unknown; slug?: unknown; fields?: unknown },
  ): CollectionDto {
    const existing = this.requireCollection(id);

    if (input.slug !== undefined && input.slug !== existing.slug) {
      throw new ApiError(400, "VALIDATION_ERROR", "Slug değiştirilemez.", {
        field: "slug",
      });
    }

    const name =
      input.name === undefined
        ? existing.name
        : unwrap(validateCollectionName(input.name));
    const fields =
      input.fields === undefined
        ? existing.fields
        : unwrap(validateFields(input.fields));

    if (input.name === undefined && input.fields === undefined) {
      return toCollectionDto(existing);
    }

    const updatedAt = Date.now();
    updateCollection(this.db, id, {
      ...(input.name !== undefined ? { name } : {}),
      ...(input.fields !== undefined ? { fieldsJson: JSON.stringify(fields) } : {}),
      updatedAt,
    });

    return {
      id: existing.id,
      name,
      slug: existing.slug,
      fields,
      createdAt: existing.createdAt,
      updatedAt,
    };
  }

  delete(id: string, confirmSlug: unknown): void {
    const existing = this.requireCollection(id);

    if (typeof confirmSlug !== "string" || confirmSlug !== existing.slug) {
      throw new ApiError(
        409,
        "SLUG_MISMATCH",
        "Silme onayı koleksiyon slug'ıyla eşleşmiyor.",
        { field: "confirmSlug" },
      );
    }

    deleteCollection(this.db, id);
  }

  requireCollection(id: string): CollectionRecord {
    const collection = findCollectionById(this.db, id);
    if (!collection) throw notFound("Koleksiyon bulunamadı.");
    return collection;
  }
}
