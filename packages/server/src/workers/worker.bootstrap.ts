import { logger } from '../utils/logger';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { disconnectRedis } from '../config/redis';
import { createScanWorker } from './scan.worker';
import { createEnrichWorker } from './enrich.worker';
import { createScoreWorker } from './score.worker';
import { createAlertEvalWorker } from './alert-eval.worker';
import { createNotificationWorker } from './notification.worker';

async function startWorkers(): Promise<void> {
  logger.info('Starting worker processes...');

  await connectDatabase();

  const scanWorker = createScanWorker();
  const enrichWorker = createEnrichWorker();
  const scoreWorker = createScoreWorker();
  const alertEvalWorker = createAlertEvalWorker();
  const notificationWorker = createNotificationWorker();

  const workers = [scanWorker, enrichWorker, scoreWorker, alertEvalWorker, notificationWorker];

  logger.info({ workerCount: workers.length }, 'All workers started and ready for jobs');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Worker received shutdown signal');

    try {
      await Promise.all(workers.map((w) => w.close()));
      await Promise.all([disconnectDatabase(), disconnectRedis()]);
      logger.info('All workers and connections closed. Exiting.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during worker shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Worker unhandled promise rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Worker uncaught exception');
    process.exit(1);
  });
}

startWorkers().catch((err) => {
  logger.fatal({ err }, 'Failed to start workers');
  process.exit(1);
});
