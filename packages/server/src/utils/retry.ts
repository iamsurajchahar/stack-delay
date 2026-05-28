import { logger } from './logger';

interface RetryOptions {
  attempts: number;
  backoff: 'exponential' | 'fixed';
  baseDelay: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { attempts, backoff, baseDelay } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;

      let delay: number;
      if (backoff === 'exponential') {
        delay = baseDelay * Math.pow(2, attempt - 1);
        // Add jitter: +/- 25% of the computed delay
        const jitter = delay * 0.25 * (Math.random() * 2 - 1);
        delay = Math.max(0, Math.round(delay + jitter));
      } else {
        delay = baseDelay;
      }

      logger.warn(
        { attempt, maxAttempts: attempts, delayMs: delay, err },
        'Retry attempt failed, waiting before next try',
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
