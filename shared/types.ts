/** Shared API contracts for the Kavram headless CMS. Framework-free. */

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "boolean",
  "date",
  "url",
  "select",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const ENTRY_STATUSES = ["draft", "published"] as const;

export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export type EntryData = Record<string, unknown>;

export interface CollectionField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
}

export interface CollectionDto {
  id: string;
  name: string;
  slug: string;
  fields: CollectionField[];
  createdAt: number;
  updatedAt: number;
}

export interface EntryDto {
  id: string;
  collectionId: string;
  data: EntryData;
  status: EntryStatus;
  createdAt: number;
  updatedAt: number;
}

/** Published entry shape exposed by the public content API. */
export interface PublicEntryDto {
  id: string;
  createdAt: number;
  updatedAt: number;
  data: EntryData;
}

export interface CollectionListResponse {
  collections: CollectionDto[];
}

export interface CollectionResponse {
  collection: CollectionDto;
}

export interface EntryListResponse {
  entries: EntryDto[];
  total: number;
}

export interface EntryResponse {
  entry: EntryDto;
}

export interface PublicEntryListResponse {
  entries: PublicEntryDto[];
}

export interface PublicEntryResponse {
  entry: PublicEntryDto;
}

export interface AdminCollectionStats {
  id: string;
  name: string;
  slug: string;
  total: number;
  draft: number;
  published: number;
}

export interface AdminStats {
  collections: AdminCollectionStats[];
  totalCollections: number;
  totalEntries: number;
  requestsLast24h: number;
}

export interface AuthSessionInfo {
  authenticated: true;
  expiresAt: number;
}

export interface HealthResponse {
  ok: true;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CSRF_REJECTED"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "SLUG_TAKEN"
  | "SLUG_MISMATCH"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    field?: string;
    retryAfterMs?: number;
  };
}
