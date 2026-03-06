/**
 * Health Check Route
 * Provides system health status including database connectivity
 */

import { Router, Request, Response } from "express";
import { checkDbHealth } from "../config/database";
import { asyncHandler } from "../middleware/errorHandler";

export const healthRouter = Router();

interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  database?: {
    connected: boolean;
  };
  uptime?: number;
}

/**
 * GET /health
 * Returns system health status
 */
healthRouter.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const dbHealthy = await checkDbHealth();

    const response: HealthResponse = {
      status: dbHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      database: {
        connected: dbHealthy,
      },
      uptime: process.uptime(),
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(response);
  }),
);

/**
 * GET /health/ready
 * Kubernetes-style readiness probe
 */
healthRouter.get(
  "/ready",
  asyncHandler(async (_req: Request, res: Response) => {
    const dbHealthy = await checkDbHealth();

    if (!dbHealthy) {
      return res.status(503).json({ ready: false });
    }

    res.json({ ready: true });
  }),
);

/**
 * GET /health/live
 * Kubernetes-style liveness probe
 */
healthRouter.get("/live", (_req: Request, res: Response) => {
  res.json({ alive: true });
});
