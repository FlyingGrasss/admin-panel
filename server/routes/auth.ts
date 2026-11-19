import { Router } from "express";
import { RATE_LIMITS } from "../constants.js";
import type { AppContext } from "../context.js";
import {
  asyncHandler,
  asRecord,
  clearSessionCookie,
  clientIp,
  createRequireAuth,
  enforceRateLimit,
  getAuth,
  getSessionToken,
  setSessionCookie,
} from "../http.js";
import { TokenBucketRateLimiter } from "../rate-limit.js";

export function createAuthRouter(ctx: AppContext): Router {
  const router = Router();
  const loginLimiter = new TokenBucketRateLimiter(
    RATE_LIMITS.login.limit,
    RATE_LIMITS.login.windowMs,
  );
  const requireAuth = createRequireAuth(ctx);

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      enforceRateLimit(loginLimiter, clientIp(req), res);

      const body = asRecord(req.body);
      const result = await ctx.services.auth.login(body.password);

      setSessionCookie(res, ctx.config, result.token, result.expiresAt);
      res.status(200).json({ authenticated: true, expiresAt: result.expiresAt });
    }),
  );

  router.post(
    "/logout",
    asyncHandler((req, res) => {
      ctx.services.auth.logout(getSessionToken(req));
      clearSessionCookie(res, ctx.config);
      res.status(204).end();
    }),
  );

  router.get("/me", requireAuth, (req, res) => {
    const auth = getAuth(req);
    res.status(200).json({ authenticated: true, expiresAt: auth.expiresAt });
  });

  return router;
}
