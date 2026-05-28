import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';

function createStore(prefix: string) {
  return new RedisStore({
    // Use ioredis `call` method compatible with rate-limit-redis
    sendCommand: (...args: string[]) =>
      redisClient.call(args[0], ...args.slice(1)) as Promise<unknown>,
    prefix: `rl:${prefix}:`,
  });
}

/**
 * General API rate limiter: 100 requests per minute
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('general'),
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Auth endpoint rate limiter: 10 requests per minute
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth'),
  message: {
    status: 'error',
    message: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Scan trigger rate limiter: 5 requests per minute
 */
export const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('scan'),
  message: {
    status: 'error',
    message: 'Too many scan requests, please try again later.',
    code: 'SCAN_RATE_LIMIT_EXCEEDED',
  },
});
