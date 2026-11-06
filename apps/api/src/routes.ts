import { Router } from "express";
import { healthRouter } from "./modules/health/health.routes";

/**
 * API v1 router. Feature modules are mounted here as they are built:
 *   Phase 1: /auth, /products, /categories, /collections, /cart
 *   Phase 3: /checkout, /orders, /payments
 *   Phase 4: /admin/*
 */
export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
