import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index';
import { User, IUserDocument } from '../models/User';
import { AppError } from './errorHandler.middleware';

declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
      userId?: string;
    }
  }
}

interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('Authentication required. Please provide a valid Bearer token.', 401, 'AUTH_REQUIRED');
    }

    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('Token has expired. Please refresh your session.', 401, 'TOKEN_EXPIRED');
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid token. Please authenticate again.', 401, 'TOKEN_INVALID');
      }
      throw err;
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw new AppError('User not found. Account may have been deleted.', 401, 'USER_NOT_FOUND');
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication: attaches user if token is present and valid,
 * but does not fail if no token is provided.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      return next();
    }

    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    } catch {
      // Invalid or expired token in optional mode is not an error
      return next();
    }

    const user = await User.findById(payload.sub);
    if (user) {
      req.user = user;
      req.userId = user._id.toString();
    }

    next();
  } catch (err) {
    next(err);
  }
}
