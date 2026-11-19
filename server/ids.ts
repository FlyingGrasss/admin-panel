import { createHash, randomBytes, randomUUID } from "node:crypto";

export function newId(): string {
  return randomUUID();
}

export function newOpaqueToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
