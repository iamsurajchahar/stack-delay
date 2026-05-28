import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const SKIP_PATHS = new Set(['/health', '/api/health', '/healthz']);

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.has(req.path)) {
    return next();
  }

  const start = Date.now();

  // Capture the original end method to log after response is sent
  const originalEnd = res.end;

  res.end = function (...args: Parameters<typeof originalEnd>): ReturnType<typeof originalEnd> {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level](
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: duration,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
    );

    return originalEnd.apply(res, args);
  } as typeof originalEnd;

  next();
}
