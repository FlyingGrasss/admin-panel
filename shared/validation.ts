import {
  ENTRY_STATUSES,
  FIELD_TYPES,
  type CollectionField,
  type EntryData,
  type EntryStatus,
  type FieldType,
} from "./types";

export interface FieldIssue {
  field: string;
  message: string;
}

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; error: FieldIssue };

export const COLLECTION_SLUG_PATTERN = /^[a-z0-9-]{2,48}$/;
export const FIELD_KEY_PATTERN = /^[a-z0-9_]{1,40}$/;

export const TEXT_MAX_LENGTH = 5_000;
export const TEXTAREA_MAX_LENGTH = 50_000;
export const COLLECTION_NAME_MAX_LENGTH = 80;
export const FIELD_LABEL_MAX_LENGTH = 120;
export const FIELD_OPTION_MAX_LENGTH = 120;

function ok<T>(value: T): Validated<T> {
  return { ok: true, value };
}

function fail<T>(field: string, message: string): Validated<T> {
  return { ok: false, error: { field, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFieldType(value: unknown): value is FieldType {
  return (
    typeof value === "string" && (FIELD_TYPES as readonly string[]).includes(value)
  );
}

function isEntryStatus(value: unknown): value is EntryStatus {
  return (
    typeof value === "string" && (ENTRY_STATUSES as readonly string[]).includes(value)
  );
}

export function validateCollectionName(value: unknown): Validated<string> {
  if (typeof value !== "string") {
    return fail("name", "Koleksiyon adı gerekli.");
  }

  const name = value.normalize("NFC").trim();
  if (name.length < 1 || name.length > COLLECTION_NAME_MAX_LENGTH) {
    return fail(
      "name",
      `Koleksiyon adı 1–${COLLECTION_NAME_MAX_LENGTH} karakter olmalı.`,
    );
  }

  return ok(name);
}

export function validateCollectionSlug(value: unknown): Validated<string> {
  if (typeof value !== "string") {
    return fail("slug", "Slug gerekli.");
  }

  if (!COLLECTION_SLUG_PATTERN.test(value)) {
    return fail(
      "slug",
      "Slug yalnızca küçük harf, rakam ve tire içerebilir (2–48 karakter).",
    );
  }

  return ok(value);
}

export function validateFields(value: unknown): Validated<CollectionField[]> {
  if (!Array.isArray(value)) {
    return fail("fields", "Alan listesi gerekli.");
  }

  if (value.length === 0) {
    return fail("fields", "En az bir alan tanımla.");
  }

  const fields: CollectionField[] = [];
  const keys = new Set<string>();

  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    const path = `fields.${index}`;

    if (!isRecord(raw)) {
      return fail(path, "Alan tanımı bir nesne olmalı.");
    }

    if (typeof raw.key !== "string" || !FIELD_KEY_PATTERN.test(raw.key)) {
      return fail(
        `${path}.key`,
        "Alan anahtarı yalnızca küçük harf, rakam ve alt çizgi içerebilir (1–40 karakter).",
      );
    }

    if (raw.key === "__proto__") {
      return fail(`${path}.key`, "Bu alan anahtarı kullanılamaz.");
    }

    if (keys.has(raw.key)) {
      return fail(`${path}.key`, `"${raw.key}" anahtarı zaten kullanılıyor.`);
    }

    if (typeof raw.label !== "string") {
      return fail(`${path}.label`, "Alan etiketi gerekli.");
    }

    const label = raw.label.normalize("NFC").trim();
    if (label.length < 1 || label.length > FIELD_LABEL_MAX_LENGTH) {
      return fail(
        `${path}.label`,
        `Alan etiketi 1–${FIELD_LABEL_MAX_LENGTH} karakter olmalı.`,
      );
    }

    if (!isFieldType(raw.type)) {
      return fail(`${path}.type`, "Geçersiz alan tipi.");
    }

    if (typeof raw.required !== "boolean") {
      return fail(`${path}.required`, "required true veya false olmalı.");
    }

    let options: string[] | undefined;
    if (raw.type === "select") {
      if (!Array.isArray(raw.options) || raw.options.length === 0) {
        return fail(`${path}.options`, "Select alanı en az bir seçenek içermeli.");
      }

      options = [];
      const seen = new Set<string>();
      for (let optionIndex = 0; optionIndex < raw.options.length; optionIndex += 1) {
        const option = raw.options[optionIndex];
        if (typeof option !== "string") {
          return fail(
            `${path}.options.${optionIndex}`,
            "Seçenekler metin olmalı.",
          );
        }

        const trimmed = option.trim();
        if (trimmed.length < 1 || trimmed.length > FIELD_OPTION_MAX_LENGTH) {
          return fail(
            `${path}.options.${optionIndex}`,
            `Seçenek 1–${FIELD_OPTION_MAX_LENGTH} karakter olmalı.`,
          );
        }

        if (seen.has(trimmed)) {
          return fail(
            `${path}.options.${optionIndex}`,
            `"${trimmed}" seçeneği zaten tanımlı.`,
          );
        }

        seen.add(trimmed);
        options.push(trimmed);
      }
    } else if (raw.options !== undefined && raw.options !== null) {
      return fail(
        `${path}.options`,
        "Seçenekler yalnızca select tipindeki alanlarda kullanılabilir.",
      );
    }

    keys.add(raw.key);
    fields.push({
      key: raw.key,
      label,
      type: raw.type,
      required: raw.required,
      ...(options ? { options } : {}),
    });
  }

  return ok(fields);
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateFieldValue(
  field: CollectionField,
  value: unknown,
): Validated<unknown> {
  const path = `data.${field.key}`;

  switch (field.type) {
    case "text": {
      if (typeof value !== "string") {
        return fail(path, `"${field.label}" metin olmalı.`);
      }
      if (value.length > TEXT_MAX_LENGTH) {
        return fail(
          path,
          `"${field.label}" en fazla ${TEXT_MAX_LENGTH} karakter olabilir.`,
        );
      }
      return ok(value);
    }

    case "textarea": {
      if (typeof value !== "string") {
        return fail(path, `"${field.label}" metin olmalı.`);
      }
      if (value.length > TEXTAREA_MAX_LENGTH) {
        return fail(
          path,
          `"${field.label}" en fazla ${TEXTAREA_MAX_LENGTH} karakter olabilir.`,
        );
      }
      return ok(value);
    }

    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return fail(path, `"${field.label}" geçerli bir sayı olmalı.`);
      }
      return ok(value);
    }

    case "boolean": {
      if (typeof value !== "boolean") {
        return fail(path, `"${field.label}" true veya false olmalı.`);
      }
      return ok(value);
    }

    case "date": {
      if (typeof value !== "string" || !isValidIsoDate(value)) {
        return fail(
          path,
          `"${field.label}" YYYY-AA-GG biçiminde geçerli bir tarih olmalı.`,
        );
      }
      return ok(value);
    }

    case "url": {
      if (typeof value !== "string") {
        return fail(path, `"${field.label}" http veya https adresi olmalı.`);
      }

      const trimmed = value.trim();
      try {
        const url = new URL(trimmed);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return fail(path, `"${field.label}" http veya https adresi olmalı.`);
        }
      } catch {
        return fail(path, `"${field.label}" http veya https adresi olmalı.`);
      }

      return ok(trimmed);
    }

    case "select": {
      if (typeof value !== "string" || !(field.options ?? []).includes(value)) {
        return fail(path, `"${field.label}" seçeneklerden biri olmalı.`);
      }
      return ok(value);
    }
  }
}

/**
 * Validates a complete entry data object against the collection field schema.
 * Unknown keys are rejected and missing optional fields normalize to null.
 */
export function validateEntryData(
  fields: CollectionField[],
  value: unknown,
): Validated<EntryData> {
  if (!isRecord(value)) {
    return fail("data", "Veri bir JSON nesnesi olmalı.");
  }

  const known = new Set(fields.map((field) => field.key));
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      return fail(`data.${key}`, `Bilinmeyen alan: ${key}.`);
    }
  }

  const data: EntryData = {};

  for (const field of fields) {
    const raw = value[field.key];
    const missing =
      raw === undefined ||
      raw === null ||
      (typeof raw === "string" && raw.trim().length === 0);

    if (missing) {
      if (field.required) {
        return fail(`data.${field.key}`, `"${field.label}" alanı zorunlu.`);
      }
      data[field.key] = null;
      continue;
    }

    const result = validateFieldValue(field, raw);
    if (!result.ok) return result;
    data[field.key] = result.value;
  }

  return ok(data);
}

export function parseEntryStatus(value: unknown): Validated<EntryStatus> {
  if (!isEntryStatus(value)) {
    return fail("status", "status draft veya published olmalı.");
  }
  return ok(value);
}

export function parseStatusFilter(value: unknown): Validated<EntryStatus | undefined> {
  if (value === undefined || value === null || value === "") {
    return ok(undefined);
  }
  if (!isEntryStatus(value)) {
    return fail("status", "status draft veya published olmalı.");
  }
  return ok(value);
}

export interface Pagination {
  limit: number;
  offset: number;
}

export function parsePagination(
  input: { limit?: unknown; offset?: unknown },
  defaultLimit: number,
  maxLimit: number,
): Validated<Pagination> {
  const limit = parseInteger(input.limit, defaultLimit, "limit");
  if (!limit.ok) return limit;
  if (limit.value < 1 || limit.value > maxLimit) {
    return fail("limit", `limit 1–${maxLimit} arasında olmalı.`);
  }

  const offset = parseInteger(input.offset, 0, "offset");
  if (!offset.ok) return offset;
  if (offset.value < 0) {
    return fail("offset", "offset 0 veya daha büyük olmalı.");
  }

  return ok({ limit: limit.value, offset: offset.value });
}

function parseInteger(
  value: unknown,
  fallback: number,
  field: string,
): Validated<number> {
  if (value === undefined || value === null || value === "") {
    return ok(fallback);
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return fail(field, `${field} bir tam sayı olmalı.`);
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || !Number.isSafeInteger(parsed)) {
    return fail(field, `${field} bir tam sayı olmalı.`);
  }

  return ok(parsed);
}
