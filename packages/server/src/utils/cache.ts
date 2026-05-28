import { redisClient } from '../config/redis';
import { logger } from './logger';

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisClient.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.error({ err, key }, 'Cache GET failed');
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    await redisClient.set(key, serialized, 'EX', ttlSeconds);
  } catch (err) {
    logger.error({ err, key }, 'Cache SET failed');
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await redisClient.del(key);
  } catch (err) {
    logger.error({ err, key }, 'Cache DELETE failed');
  }
}

export async function cacheBust(pattern: string): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.error({ err, pattern }, 'Cache BUST failed');
  }
}
