import type { ApiErrorBody, ApiErrorCode } from "@shared/types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | "NETWORK_ERROR";
  readonly field?: string;
  readonly retryAfterMs?: number;

  constructor(
    status: number,
    code: ApiErrorCode | "NETWORK_ERROR",
    message: string,
    options: { field?: string; retryAfterMs?: number } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = options.field;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** The login request handles its own 401 instead of leaving the page. */
  redirectOnUnauthorized?: boolean;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }

  const error = (value as { error?: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json();
    if (isApiErrorBody(body)) {
      return new ApiError(response.status, body.error.code, body.error.message, {
        ...(body.error.field ? { field: body.error.field } : {}),
        ...(body.error.retryAfterMs !== undefined
          ? { retryAfterMs: body.error.retryAfterMs }
          : {}),
      });
    }
  } catch {
    // A proxy or a crash can return a non-JSON body. Fall through to a safe message.
  }

  return new ApiError(
    response.status,
    "INTERNAL_ERROR",
    "İstek tamamlanamadı. Lütfen tekrar dene.",
  );
}

/**
 * Browser-side client for the Kavram API. Always identifies the panel client so
 * the API's CSRF guard accepts mutating requests.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Kavram-Client": "panel",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      credentials: "same-origin",
      cache: "no-store",
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "API’ye ulaşılamadı. Sunucunun çalıştığından emin ol.",
    );
  }

  if (!response.ok) {
    const apiError = await toApiError(response);

    if (
      response.status === 401 &&
      options.redirectOnUnauthorized !== false &&
      typeof window !== "undefined"
    ) {
      window.location.assign("/login");
    }

    throw apiError;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (text.trim() === "") {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      response.status,
      "INTERNAL_ERROR",
      "API beklenmeyen bir yanıt döndü.",
    );
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "PATCH", body });
}

export function apiDelete<T = void>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, body === undefined ? { method: "DELETE" } : { method: "DELETE", body });
}
