import { redisClient, isRedisEnabled } from '../config/redis';
import { logger } from './logger';

/**
 * In-process fallback cache used when REDIS_HOST is unset (dev mode).
 * Without it every enrichment call would hit the network again on each scan,
 * which is the single biggest cost of a repository scan.
 */
const MEMORY_CACHE_MAX_ENTRIES = 5000;
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

function memoryGet(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  // Refresh insertion order so hot keys survive eviction
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds: number): void {
  memoryCache.delete(key);
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });

  while (memoryCache.size > MEMORY_CACHE_MAX_ENTRIES) {
    const oldest = memoryCache.keys().next();
    if (oldest.done) break;
    memoryCache.delete(oldest.value);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisEnabled) {
    const raw = memoryGet(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

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
  const serialized = JSON.stringify(value);

  if (!isRedisEnabled) {
    memorySet(key, serialized, ttlSeconds);
    return;
  }

  try {
    await redisClient.set(key, serialized, 'EX', ttlSeconds);
  } catch (err) {
    logger.error({ err, key }, 'Cache SET failed');
  }
}

export async function cacheDelete(key: string): Promise<void> {
  if (!isRedisEnabled) {
    memoryCache.delete(key);
    return;
  }

  try {
    await redisClient.del(key);
  } catch (err) {
    logger.error({ err, key }, 'Cache DELETE failed');
  }
}

export async function cacheBust(pattern: string): Promise<void> {
  if (!isRedisEnabled) {
    // Translate a Redis glob into a prefix/suffix match good enough for our keys
    const matcher = new RegExp(
      '^' + pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$',
    );
    for (const key of memoryCache.keys()) {
      if (matcher.test(key)) memoryCache.delete(key);
    }
    return;
  }

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
