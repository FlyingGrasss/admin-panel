import { Router } from "express";
import type { AppContext } from "../context.js";
import {
  asyncHandler,
  asRecord,
  createRequireAuth,
  pathParam,
} from "../http.js";

export function createEntriesRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(createRequireAuth(ctx));

  router.get("/:collectionId", (req, res) => {
    const result = ctx.services.entries.listAdmin(pathParam(req, "collectionId"), {
      status: req.query.status,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.status(200).json(result);
  });

  router.post(
    "/:collectionId",
    asyncHandler((req, res) => {
      const body = asRecord(req.body);
      const entry = ctx.services.entries.create(pathParam(req, "collectionId"), {
        data: body.data,
        status: body.status,
      });
      res.status(201).json({ entry });
    }),
  );

  router.patch(
    "/:id",
    asyncHandler((req, res) => {
      const body = asRecord(req.body);
      const entry = ctx.services.entries.update(pathParam(req, "id"), {
        data: body.data,
        status: body.status,
      });
      res.status(200).json({ entry });
    }),
  );

  router.delete(
    "/:id",
    asyncHandler((req, res) => {
      ctx.services.entries.delete(pathParam(req, "id"));
      res.status(204).end();
    }),
  );

  return router;
}
