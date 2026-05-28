import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { isDev } from '../config/index';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

interface ErrorResponse {
  status: 'error';
  message: string;
  code?: string;
  errors?: unknown;
  stack?: string;
}

function handleMongooseValidationError(err: mongoose.Error.ValidationError): {
  statusCode: number;
  response: ErrorResponse;
} {
  const errors: Record<string, string> = {};
  for (const [field, detail] of Object.entries(err.errors)) {
    errors[field] = detail.message;
  }
  return {
    statusCode: 400,
    response: {
      status: 'error',
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors,
    },
  };
}

function handleMongooseCastError(err: mongoose.Error.CastError): {
  statusCode: number;
  response: ErrorResponse;
} {
  return {
    statusCode: 400,
    response: {
      status: 'error',
      message: `Invalid ${err.path}: ${String(err.value)}`,
      code: 'INVALID_PARAMETER',
    },
  };
}

function handleDuplicateKeyError(err: unknown): {
  statusCode: number;
  response: ErrorResponse;
} {
  const keyValueMatch = String(err).match(/dup key: \{(.+?)\}/);
  const duplicateField = keyValueMatch ? keyValueMatch[1].trim() : 'unknown';
  return {
    statusCode: 409,
    response: {
      status: 'error',
      message: `Duplicate value for: ${duplicateField}`,
      code: 'DUPLICATE_KEY',
    },
  };
}

function handleJWTError(err: JsonWebTokenError): {
  statusCode: number;
  response: ErrorResponse;
} {
  if (err instanceof TokenExpiredError) {
    return {
      statusCode: 401,
      response: {
        status: 'error',
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      },
    };
  }
  return {
    statusCode: 401,
    response: {
      status: 'error',
      message: 'Invalid token',
      code: 'TOKEN_INVALID',
    },
  };
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let response: ErrorResponse = {
    status: 'error',
    message: 'Internal server error',
  };

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    response = {
      status: 'error',
      message: err.message,
      code: err.code,
    };
  } else if (err instanceof mongoose.Error.ValidationError) {
    const result = handleMongooseValidationError(err);
    statusCode = result.statusCode;
    response = result.response;
  } else if (err instanceof mongoose.Error.CastError) {
    const result = handleMongooseCastError(err);
    statusCode = result.statusCode;
    response = result.response;
  } else if ((err as { code?: number }).code === 11000) {
    const result = handleDuplicateKeyError(err);
    statusCode = result.statusCode;
    response = result.response;
  } else if (err instanceof JsonWebTokenError) {
    const result = handleJWTError(err);
    statusCode = result.statusCode;
    response = result.response;
  }

  if (statusCode >= 500) {
    logger.error({ err, statusCode }, 'Unhandled server error');
  } else {
    logger.warn({ err: err.message, statusCode }, 'Client error');
  }

  if (isDev) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
