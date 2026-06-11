import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

const isRedisDisabled = !config.REDIS_HOST;

function buildRedisOptions(): {
  host: string;
  port: number;
  password?: string;
  tls?: {};
  maxRetriesPerRequest: null;
  retryStrategy: (times: number) => number | null;
  lazyConnect?: boolean;
} {
  return {
    host: config.REDIS_HOST || '127.0.0.1',
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    tls: config.REDIS_HOST?.includes('upstash.io') ? {} : undefined,
    maxRetriesPerRequest: null,
    lazyConnect: isRedisDisabled,
    retryStrategy(times: number): number | null {
      if (isRedisDisabled) return null;
      if (times > 10) {
        logger.fatal('Redis reconnect attempts exhausted');
        return null;
      }
      const delay = Math.min(times * 500, 5000);
      logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting...');
      return delay;
    },
  };
}

export const redisClient = new Redis(buildRedisOptions());

if (isRedisDisabled) {
  logger.info('Redis disabled — running without cache (dev mode)');
} else {
  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });
}

redisClient.on('error', (err) => {
  if (isRedisDisabled) return; // Suppress errors when disabled
  logger.error({ err }, 'Redis client error');
});

redisClient.on('close', () => {
  if (isRedisDisabled) return;
  logger.warn('Redis connection closed');
});

export function createRedisConnection(): any {
  const connection = new Redis(buildRedisOptions());

  connection.on('error', (err) => {
    if (isRedisDisabled) return;
    logger.error({ err }, 'BullMQ Redis connection error');
  });

  return connection;
}

export async function disconnectRedis(): Promise<void> {
  if (isRedisDisabled) return;
  try {
    await redisClient.quit();
    logger.info('Redis disconnected gracefully');
  } catch (err) {
    logger.error({ err }, 'Error during Redis disconnect');
  }
}
