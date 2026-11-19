import { resolve } from "node:path";
import { DEFAULT_ADMIN_PASSWORD } from "./constants.js";
import type { AppConfig } from "./config.js";
import { resolveConfig } from "./config.js";
import type { AppDatabase } from "./db.js";
import { openDatabase } from "./db.js";
import { AuthService } from "./services/auth.js";
import { CollectionService } from "./services/collections.js";
import { EntryService } from "./services/entries.js";
import { StatsService } from "./services/stats.js";

export interface AppServices {
  auth: AuthService;
  collections: CollectionService;
  entries: EntryService;
  stats: StatsService;
}

export interface AppContext {
  config: AppConfig;
  db: AppDatabase;
  services: AppServices;
  close(): void;
}

export interface CreateContextOptions {
  env?: NodeJS.ProcessEnv;
  config?: AppConfig;
  dbPath?: string;
  schemaPath?: string;
  isProduction?: boolean;
  allowedOrigins?: string[];
  adminPassword?: string;
}

export function createContext(options: CreateContextOptions = {}): AppContext {
  const base = options.config ?? resolveConfig(options.env);
  const adminPassword = options.adminPassword ?? base.adminPassword;
  const config: AppConfig = {
    ...base,
    ...(options.dbPath ? { dbPath: resolve(options.dbPath) } : {}),
    ...(options.isProduction !== undefined
      ? { isProduction: options.isProduction }
      : {}),
    ...(options.allowedOrigins ? { allowedOrigins: [...options.allowedOrigins] } : {}),
    adminPassword,
    usingDefaultAdminPassword: adminPassword === DEFAULT_ADMIN_PASSWORD,
  };

  const db = openDatabase(config.dbPath, options.schemaPath);
  const auth = new AuthService(db, config);
  const collections = new CollectionService(db);
  const entries = new EntryService(db);
  const stats = new StatsService(db);

  let closed = false;

  return {
    config,
    db,
    services: { auth, collections, entries, stats },
    close() {
      if (closed) return;
      closed = true;
      db.close();
    },
  };
}
