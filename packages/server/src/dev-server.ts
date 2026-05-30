import path from 'node:path';
import dotenv from 'dotenv';

// Load .env from project root BEFORE any config imports
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Redis enabled via .env (Upstash)

async function startDev() {
  // Dynamic import so logger loads AFTER env is set
  const { logger } = await import('./utils/logger');

  logger.info('Starting development server with remote MongoDB...');
  logger.info({ mongoUri: process.env.MONGODB_URI }, 'Using configured MongoDB');

  // Now import and start the actual server (config will read env vars)
  await import('./server');

  const shutdown = async () => {
    logger.info('Shutting down dev server...');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startDev().catch((err) => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});
