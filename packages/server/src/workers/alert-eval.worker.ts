import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { QUEUE_NAMES, notificationQueue } from './queues';
import { evaluateAlerts } from '../services/alert.service';
import { RepoScoreSnapshot } from '../models/RepoScoreSnapshot';
import { logger } from '../utils/logger';

interface AlertEvalJobData {
  repositoryId: string;
  scanId: string;
  userId: string;
  compositeScore: number;
  grade: string;
}

export function createAlertEvalWorker() {
  const worker = new Worker<AlertEvalJobData>(
    QUEUE_NAMES.ALERT_EVALUATION,
    async (job: Job<AlertEvalJobData>) => {
      const { repositoryId, scanId, userId, compositeScore, grade } = job.data;
      const log = logger.child({ scanId, repositoryId, jobId: job.id });

      log.info('Starting alert evaluation');

      try {
        // Get previous snapshot for comparison
        const previousSnapshots = await RepoScoreSnapshot.find({ repositoryId })
          .sort({ snapshotDate: -1 })
          .limit(2);

        const currentSnapshot = previousSnapshots[0];
        const previousSnapshot = previousSnapshots.length > 1 ? previousSnapshots[1] : null;

        const triggeredAlerts = await evaluateAlerts(
          repositoryId,
          previousSnapshot ? {
            compositeScore: previousSnapshot.compositeScore,
            grade: previousSnapshot.grade,
            vulnerableCount: previousSnapshot.vulnerableCount,
            deprecatedCount: previousSnapshot.deprecatedCount,
            eolAvg: previousSnapshot.eolAvg,
          } : null,
          {
            compositeScore,
            grade,
            vulnerableCount: currentSnapshot?.vulnerableCount ?? 0,
            deprecatedCount: currentSnapshot?.deprecatedCount ?? 0,
            eolAvg: currentSnapshot?.eolAvg ?? 100,
          }
        );

        if (triggeredAlerts.length === 0) {
          log.info('No alerts triggered');
          return;
        }

        log.info({ triggeredCount: triggeredAlerts.length }, 'Alerts triggered');

        // Enqueue notification jobs for each triggered alert
        const notificationJobs = triggeredAlerts.map((alert) => ({
          name: 'send-notification',
          data: {
            userId,
            alertRuleId: alert.ruleId,
            channels: alert.channels,
            subject: alert.subject,
            body: alert.body,
            repositoryId,
          },
        }));

        await notificationQueue.addBulk(notificationJobs);

        await job.updateProgress(100);
      } catch (error: any) {
        log.error({ error: error.message }, 'Alert evaluation failed');
        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Alert eval worker completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Alert eval worker failed');
  });

  return worker;
}
