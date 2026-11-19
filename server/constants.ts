/** Server-side constants shared by the API process and smoke tests. */

export const API_DEFAULT_PORT = 4400;
export const API_DEFAULT_HOST = "127.0.0.1";

export const SESSION_COOKIE_NAME = "kavram_session";
export const SESSION_TOKEN_BYTES = 32;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const CLIENT_HEADER_NAME = "x-kavram-client";
export const CLIENT_HEADER_VALUE = "panel";
export const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const;

export const DEFAULT_ADMIN_PASSWORD = "admin";
export const MAX_BODY_BYTES = 1024 * 1024;

export const RATE_LIMITS = {
  login: { limit: 5, windowMs: 60_000 },
  publicRead: { limit: 120, windowMs: 60_000 },
} as const;

export const SCRYPT_PARAMS = {
  N: 32_768,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024,
} as const;

export const ADMIN_ENTRY_PAGE_DEFAULT_LIMIT = 50;
export const ADMIN_ENTRY_PAGE_MAX_LIMIT = 100;
export const PUBLIC_ENTRY_PAGE_DEFAULT_LIMIT = 20;
export const PUBLIC_ENTRY_PAGE_MAX_LIMIT = 100;
