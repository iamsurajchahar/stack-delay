import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

function buildRedisOptions(): {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: null;
  retryStrategy: (times: number) => number | null;
} {
  return {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    retryStrategy(times: number): number | null {
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

redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('error', (err) => {
  logger.error({ err }, 'Redis client error');
});

redisClient.on('close', () => {
  logger.warn('Redis connection closed');
});

/**
 * Create a new Redis connection for BullMQ workers.
 * BullMQ requires dedicated connections, not shared ones.
 */
export function createRedisConnection(): Redis {
  const connection = new Redis(buildRedisOptions());

  connection.on('error', (err) => {
    logger.error({ err }, 'BullMQ Redis connection error');
  });

  return connection;
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redisClient.quit();
    logger.info('Redis disconnected gracefully');
  } catch (err) {
    logger.error({ err }, 'Error during Redis disconnect');
  }
}
