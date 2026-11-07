import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { buildOpenApiSpec } from "./openapi";

/** Interactive API docs at /api/docs and the raw spec at /api/docs/openapi.json. */
export function docsRouter(): Router {
  const router = Router();
  const spec = buildOpenApiSpec();

  router.get("/openapi.json", (_req, res) => {
    res.json(spec);
  });
  router.use(
    "/",
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: "Urban Store API",
      swaggerOptions: { persistAuthorization: true, withCredentials: true },
    }),
  );
  return router;
}
