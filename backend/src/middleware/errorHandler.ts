/**
 * Error Handling Middleware
 * Centralizes error responses with proper HTTP status codes
 */

import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  status?: number;
  code?: string;
}

/**
 * Create a structured error response
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Error handler middleware
 * Should be the last middleware registered
 */
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.status || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.message || "Internal server error";

  // Log error details
  if (status >= 500) {
    console.error(`❌ [${code}] ${status} - ${message}`);
    console.error(err.stack);
  } else {
    console.warn(`⚠️  [${code}] ${status} - ${message}`);
  }

  // Send response
  res.status(status).json({
    error: {
      code,
      message,
      status,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
}

/**
 * Async route wrapper to catch errors
 * Usage: app.get('/route', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Common HTTP errors
 */
export const Errors = {
  notFound: (message: string) => new HttpError(404, "NOT_FOUND", message),

  badRequest: (message: string) => new HttpError(400, "BAD_REQUEST", message),

  conflict: (message: string) => new HttpError(409, "CONFLICT", message),

  unauthorized: (message: string) =>
    new HttpError(401, "UNAUTHORIZED", message),

  forbidden: (message: string) => new HttpError(403, "FORBIDDEN", message),

  validationError: (message: string) =>
    new HttpError(422, "VALIDATION_ERROR", message),

  internalError: (message: string) =>
    new HttpError(500, "INTERNAL_ERROR", message),
};
