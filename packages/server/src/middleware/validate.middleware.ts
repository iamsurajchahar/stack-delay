import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

interface ValidationTarget {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validate request body against a Zod schema.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        _res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors,
        });
        return;
      }
      next(err);
    }
  };
}

/**
 * Validate request query parameters against a Zod schema.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        _res.status(400).json({
          status: 'error',
          message: 'Query validation failed',
          code: 'QUERY_VALIDATION_ERROR',
          errors,
        });
        return;
      }
      next(err);
    }
  };
}

/**
 * Validate multiple request targets (body, query, params) at once.
 */
export function validate(targets: ValidationTarget) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allErrors: Array<{ target: string; path: string; message: string }> = [];

    if (targets.params) {
      const result = targets.params.safeParse(req.params);
      if (!result.success) {
        for (const e of result.error.errors) {
          allErrors.push({ target: 'params', path: e.path.join('.'), message: e.message });
        }
      } else {
        req.params = result.data;
      }
    }

    if (targets.query) {
      const result = targets.query.safeParse(req.query);
      if (!result.success) {
        for (const e of result.error.errors) {
          allErrors.push({ target: 'query', path: e.path.join('.'), message: e.message });
        }
      } else {
        req.query = result.data;
      }
    }

    if (targets.body) {
      const result = targets.body.safeParse(req.body);
      if (!result.success) {
        for (const e of result.error.errors) {
          allErrors.push({ target: 'body', path: e.path.join('.'), message: e.message });
        }
      } else {
        req.body = result.data;
      }
    }

    if (allErrors.length > 0) {
      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: allErrors,
      });
      return;
    }

    next();
  };
}
