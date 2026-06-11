import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { config } from './config/index';
import { connectDatabase, disconnectDatabase } from './config/database';
import { disconnectRedis } from './config/redis';
import { logger } from './utils/logger';
import { createScanWorker } from './workers/scan.worker';
import { createEnrichWorker } from './workers/enrich.worker';
import { createScoreWorker } from './workers/score.worker';
import { createAlertEvalWorker } from './workers/alert-eval.worker';
import { createNotificationWorker } from './workers/notification.worker';

async function start(): Promise<void> {
  // Connect to MongoDB
  await connectDatabase();

  // On single-service deployments (e.g. Render free tier) run the BullMQ
  // workers inside the API process instead of a separate worker process
  const workers = config.START_WORKERS
    ? [
        createScanWorker(),
        createEnrichWorker(),
        createScoreWorker(),
        createAlertEvalWorker(),
        createNotificationWorker(),
      ]
    : [];

  if (workers.length > 0) {
    logger.info({ workerCount: workers.length }, 'In-process workers started');
  }

  // Create HTTP server
  const server = http.createServer(app);

  // Setup Socket.IO for real-time scan updates
  const io = new SocketIOServer(server, {
    cors: {
      origin: config.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Socket.IO client connected');

    socket.on('subscribe:scan', (scanId: string) => {
      socket.join(`scan:${scanId}`);
      logger.debug({ socketId: socket.id, scanId }, 'Client subscribed to scan updates');
    });

    socket.on('unsubscribe:scan', (scanId: string) => {
      socket.leave(`scan:${scanId}`);
    });

    socket.on('subscribe:repo', (repoId: string) => {
      socket.join(`repo:${repoId}`);
      logger.debug({ socketId: socket.id, repoId }, 'Client subscribed to repo updates');
    });

    socket.on('unsubscribe:repo', (repoId: string) => {
      socket.leave(`repo:${repoId}`);
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Socket.IO client disconnected');
    });
  });

  // Make io available to the rest of the app
  app.set('io', io);

  // Start listening
  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal, closing gracefully...');

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close Socket.IO
        io.close();
        logger.info('Socket.IO server closed');

        // Close in-process workers, then database and Redis
        await Promise.all(workers.map((w) => w.close()));
        await Promise.all([disconnectDatabase(), disconnectRedis()]);

        logger.info('All connections closed. Exiting.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });
}

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
