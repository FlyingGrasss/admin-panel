import type { CollectionField, EntryDto } from "@shared/types";

function asDisplayString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim().replace(/\s+/g, " ");
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  return null;
}

/**
 * The first text field is the human-readable title. Fall back to the first
 * populated field, then to a short id so every row remains identifiable.
 */
export function entryTitle(entry: EntryDto, fields: CollectionField[]): string {
  const textFields = fields.filter((field) => field.type === "text");  for (const field of textFields) {
    const value = asDisplayString(entry.data[field.key]);
    if (value !== null) return value;
  }

  for (const field of fields) {
    const value = asDisplayString(entry.data[field.key]);
    if (value !== null) return value;
  }

  return `Giriş ${entry.id.slice(0, 6)}`;
}
