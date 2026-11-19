import express, { type NextFunction, type Request, type Response } from "express";
import { MAX_BODY_BYTES } from "./constants.js";
import type { AppContext } from "./context.js";
import { ApiError, sendApiError } from "./errors.js";
import { createCsrfGuard, requireJsonForMutations } from "./http.js";
import { insertApiEvent } from "./repos/events.js";
import { createAuthRouter } from "./routes/auth.js";
import { createCollectionsRouter } from "./routes/collections.js";
import { createContentRouter } from "./routes/content.js";
import { createEntriesRouter } from "./routes/entries.js";
import { createMetaRouter, healthHandler } from "./routes/meta.js";

export function createApp(ctx: AppContext): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("case sensitive routing", true);
  if (ctx.config.trustProxy) app.set("trust proxy", 1);

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use("/api", createApiEventLogger(ctx));

  app.use("/api", createCsrfGuard(ctx.config));
  app.use("/api", requireJsonForMutations);
  app.use("/api", express.json({ limit: MAX_BODY_BYTES, type: "application/json" }));

  app.use("/api/auth", createAuthRouter(ctx));
  app.use("/api/admin/collections", createCollectionsRouter(ctx));
  app.use("/api/admin/entries", createEntriesRouter(ctx));
  app.use("/api/content", createContentRouter(ctx));
  app.use("/api", createMetaRouter(ctx));

  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Kaynak bulunamadı." },
    });
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Kaynak bulunamadı." },
    });
  });

  app.use(apiErrorHandler);

  return app;
}

function createApiEventLogger(ctx: AppContext): express.RequestHandler {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      if (req.method === "OPTIONS") return;

      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const path = (req.originalUrl.split("?")[0] || req.path).slice(0, 500);

      try {
        insertApiEvent(ctx.db, {
          method: req.method,
          path,
          status: res.statusCode,
          durationMs: Math.max(0, Math.round(durationMs)),
          createdAt: Date.now(),
        });
      } catch (error) {
        console.error(`[api] ${req.method} ${path} olay kaydı yazılamadı:`, error);
      }
    });

    next();
  };
}

function apiErrorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    sendApiError(res, error);
    return;
  }

  const type = readErrorType(error);

  if (type === "entity.too.large") {
    sendApiError(
      res,
      new ApiError(413, "PAYLOAD_TOO_LARGE", "İstek gövdesi çok büyük."),
    );
    return;
  }

  if (type === "entity.parse.failed") {
    sendApiError(res, new ApiError(400, "INVALID_JSON", "İstek gövdesi geçerli JSON değil."));
    return;
  }

  if (type === "charset.unsupported" || type === "encoding.unsupported") {
    sendApiError(
      res,
      new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Desteklenmeyen karakter kodlaması."),
    );
    return;
  }

  console.error(`[api] ${req.method} ${req.path} işlenemedi:`, error);
  sendApiError(
    res,
    new ApiError(500, "INTERNAL_ERROR", "Beklenmeyen bir sunucu hatası oluştu."),
  );
}

function readErrorType(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("type" in error)) {
    return undefined;
  }
  const type = (error as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
}
