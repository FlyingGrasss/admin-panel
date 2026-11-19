import { Router, type Request, type Response } from "express";
import type { AppContext } from "../context.js";
import { createRequireAuth } from "../http.js";

export function healthHandler(_req: Request, res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true });
}

export function createMetaRouter(ctx: AppContext): Router {
  const router = Router();
  const requireAuth = createRequireAuth(ctx);

  router.get("/health", healthHandler);

  router.get("/admin/stats", requireAuth, (_req, res) => {
    res.status(200).json(ctx.services.stats.getStats());
  });

  return router;
}
