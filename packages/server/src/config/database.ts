import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../utils/logger';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

export async function connectDatabase(): Promise<void> {
  let retries = 0;

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(config.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      return;
    } catch (err) {
      retries++;
      logger.error(
        { err, attempt: retries, maxRetries: MAX_RETRIES },
        'Failed to connect to MongoDB, retrying...',
      );

      if (retries >= MAX_RETRIES) {
        logger.fatal('Exhausted all MongoDB connection retries. Exiting.');
        process.exit(1);
      }

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * retries));
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected gracefully');
  } catch (err) {
    logger.error({ err }, 'Error during MongoDB disconnect');
  }
}
