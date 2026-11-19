import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthSessionInfo } from "@shared/types";
import { ApiError } from "./api";

const API_URL = (process.env.API_URL?.trim() || "http://127.0.0.1:4400").replace(
  /\/+$/,
  "",
);

/**
 * Server components cannot reuse the browser client: they need an absolute API
 * URL and must forward the HTTP-only session cookie explicitly.
 */
export async function serverApiGet<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Kavram-Client": "panel",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "API’ye ulaşılamadı. Sunucunun çalıştığından emin ol.",
    );
  }

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof (body as { error?: unknown }).error === "object" &&
        (body as { error?: unknown }).error !== null
      ) {
        const error = (body as { error: { code?: unknown; message?: unknown; field?: unknown; retryAfterMs?: unknown } }).error;
        if (typeof error.code === "string" && typeof error.message === "string") {
          throw new ApiError(
            response.status,
            error.code as ApiError["code"],
            error.message,
            {
              ...(typeof error.field === "string" ? { field: error.field } : {}),
              ...(typeof error.retryAfterMs === "number"
                ? { retryAfterMs: error.retryAfterMs }
                : {}),
            },
          );
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
    }

    throw new ApiError(
      response.status,
      "INTERNAL_ERROR",
      "Veriler alınamadı. Lütfen sayfayı yenile.",
    );
  }

  return (await response.json()) as T;
}

export async function getSession(): Promise<AuthSessionInfo | null> {
  return serverApiGet<AuthSessionInfo>("/api/auth/me");
}

export async function requireSession(): Promise<AuthSessionInfo> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
