/**
 * Request Logging Middleware
 * Logs HTTP requests and their responses
 */

import { Request, Response, NextFunction } from "express";

export interface RequestWithLog extends Request {
  startTime?: number;
}

/**
 * Simple request logger
 */
export function logger(
  req: RequestWithLog,
  res: Response,
  next: NextFunction,
): void {
  req.startTime = Date.now();

  // Capture the original res.send function
  const originalSend = res.send;
  res.send = function (data: unknown) {
    res.send = originalSend; // Restore original send

    const duration = Date.now() - (req.startTime || 0);
    const statusColor = res.statusCode < 400 ? "✓" : "❌";
    const method = req.method.padEnd(6);
    const path = req.path.padEnd(30);
    const status = res.statusCode.toString().padEnd(3);

    console.log(`${statusColor} ${method} ${path} ${status} ${duration}ms`);

    return res.send(data);
  };

  next();
}

/**
 * Structured logger for internal events
 */
export const log = {
  info: (message: string, data?: unknown) => {
    console.log(`ℹ️  ${message}`, data ? JSON.stringify(data) : "");
  },

  debug: (message: string, data?: unknown) => {
    if (process.env.LOG_LEVEL === "debug") {
      console.log(`🐛 ${message}`, data ? JSON.stringify(data) : "");
    }
  },

  warn: (message: string, data?: unknown) => {
    console.warn(`⚠️  ${message}`, data ? JSON.stringify(data) : "");
  },

  error: (message: string, error?: unknown) => {
    console.error(`❌ ${message}`);
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (process.env.NODE_ENV === "development") {
        console.error(error.stack);
      }
    } else if (error) {
      console.error(`   ${JSON.stringify(error)}`);
    }
  },
};
