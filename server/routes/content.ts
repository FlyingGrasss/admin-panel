import { Router } from "express";
import { RATE_LIMITS } from "../constants.js";
import type { AppContext } from "../context.js";
import { clientIp, enforceRateLimit, pathParam } from "../http.js";
import { TokenBucketRateLimiter } from "../rate-limit.js";

export function createContentRouter(ctx: AppContext): Router {
  const router = Router();
  const publicLimiter = new TokenBucketRateLimiter(
    RATE_LIMITS.publicRead.limit,
    RATE_LIMITS.publicRead.windowMs,
  );

  router.use((req, res, next) => {
    enforceRateLimit(publicLimiter, clientIp(req), res);
    next();
  });

  router.get("/:collectionSlug", (req, res) => {
    const entries = ctx.services.entries.listPublic(
      pathParam(req, "collectionSlug"),
      {
        limit: req.query.limit,
        offset: req.query.offset,
      },
    );
    res.status(200).json({ entries });
  });

  router.get("/:collectionSlug/:id", (req, res) => {
    const entry = ctx.services.entries.getPublic(
      pathParam(req, "collectionSlug"),
      pathParam(req, "id"),
    );
    res.status(200).json({ entry });
  });

  return router;
}
