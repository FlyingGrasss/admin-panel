import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { SCRYPT_PARAMS, SESSION_TOKEN_BYTES, SESSION_TTL_MS } from "../constants.js";
import type { AppConfig } from "../config.js";
import type { AppDatabase } from "../db.js";
import { ApiError } from "../errors.js";
import { newId, newOpaqueToken, sha256Hex } from "../ids.js";
import {
  deleteExpiredSessions,
  deleteSessionByTokenHash,
  findSessionByTokenHash,
  insertSession,
} from "../repos/sessions.js";

export interface AuthContext {
  sessionId: string;
  expiresAt: number;
}

export interface AuthResult {
  token: string;
  expiresAt: number;
}

const ADMIN_PASSWORD_SALT = randomBytes(16);

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_PARAMS.keyLength,
      {
        N: SCRYPT_PARAMS.N,
        r: SCRYPT_PARAMS.r,
        p: SCRYPT_PARAMS.p,
        maxmem: SCRYPT_PARAMS.maxmem,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

/**
 * Hashes the submitted and configured passwords with the same scrypt cost and
 * compares the derived keys in constant time.
 */
export async function verifyAdminPassword(
  submitted: string,
  expected: string,
): Promise<boolean> {
  const [candidate, reference] = await Promise.all([
    deriveKey(submitted, ADMIN_PASSWORD_SALT),
    deriveKey(expected, ADMIN_PASSWORD_SALT),
  ]);

  if (candidate.length !== reference.length) return false;
  return timingSafeEqual(candidate, reference);
}

export class AuthService {
  constructor(
    private readonly db: AppDatabase,
    private readonly config: AppConfig,
  ) {}

  async login(password: unknown): Promise<AuthResult> {
    const submitted = typeof password === "string" ? password : "";
    const matches = await verifyAdminPassword(submitted, this.config.adminPassword);

    if (!matches) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Parola hatalı.");
    }

    const token = newOpaqueToken(SESSION_TOKEN_BYTES);
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;

    this.db.transaction(() => {
      deleteExpiredSessions(this.db, now);
      insertSession(this.db, {
        id: newId(),
        tokenHash: sha256Hex(token),
        createdAt: now,
        expiresAt,
      });
    })();

    return { token, expiresAt };
  }

  logout(token: string | null): void {
    if (!token) return;
    deleteSessionByTokenHash(this.db, sha256Hex(token));
  }

  resolveSession(token: string | null, now: number = Date.now()): AuthContext | null {
    if (!token) return null;

    const session = findSessionByTokenHash(this.db, sha256Hex(token), now);
    if (!session) return null;

    return { sessionId: session.sessionId, expiresAt: session.expiresAt };
  }
}
