import { Router } from "express";
import type { AppContext } from "../context.js";
import {
  asyncHandler,
  asRecord,
  createRequireAuth,
  pathParam,
} from "../http.js";

export function createCollectionsRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(createRequireAuth(ctx));

  router.get("/", (_req, res) => {
    res.status(200).json({ collections: ctx.services.collections.list() });
  });

  router.post(
    "/",
    asyncHandler((req, res) => {
      const body = asRecord(req.body);
      const collection = ctx.services.collections.create({
        name: body.name,
        slug: body.slug,
        fields: body.fields,
      });
      res.status(201).json({ collection });
    }),
  );

  router.patch(
    "/:id",
    asyncHandler((req, res) => {
      const body = asRecord(req.body);
      const collection = ctx.services.collections.update(pathParam(req, "id"), {
        name: body.name,
        slug: body.slug,
        fields: body.fields,
      });
      res.status(200).json({ collection });
    }),
  );

  router.delete(
    "/:id",
    asyncHandler((req, res) => {
      const body = asRecord(req.body);
      ctx.services.collections.delete(pathParam(req, "id"), body.confirmSlug);
      res.status(204).end();
    }),
  );

  return router;
}
