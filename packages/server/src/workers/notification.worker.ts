import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { QUEUE_NAMES } from './queues';
import { sendNotification } from '../services/notification.service';
import { Notification } from '../models/Notification';
import { logger } from '../utils/logger';

interface NotificationJobData {
  userId: string;
  alertRuleId?: string;
  channels: string[];
  subject: string;
  body: string;
  repositoryId: string;
}

export function createNotificationWorker() {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION_SEND,
    async (job: Job<NotificationJobData>) => {
      const { userId, alertRuleId, channels, subject, body, repositoryId } = job.data;
      const log = logger.child({ userId, jobId: job.id });

      log.info({ channels, subject }, 'Sending notifications');

      const results: { channel: string; success: boolean; error?: string }[] = [];

      for (const channel of channels) {
        const notification = new Notification({
          userId,
          alertRuleId,
          channel,
          subject,
          body,
          status: 'pending',
        });

        try {
          await sendNotification({
            channel: channel as 'email' | 'webhook' | 'slack',
            to: userId,
            subject,
            body,
            repositoryId,
          });

          notification.status = 'sent';
          notification.sentAt = new Date();
          results.push({ channel, success: true });
        } catch (error: any) {
          notification.status = 'failed';
          notification.errorMessage = error.message || 'Unknown error';
          results.push({ channel, success: false, error: error.message });
          log.error({ channel, error: error.message }, 'Notification send failed');
        }

        await notification.save();
      }

      const allFailed = results.every((r) => !r.success);
      if (allFailed && results.length > 0) {
        throw new Error(`All notification channels failed: ${results.map((r) => `${r.channel}: ${r.error}`).join('; ')}`);
      }

      await job.updateProgress(100);
      log.info({ results }, 'Notification processing complete');
    },
    {
      connection: createRedisConnection(),
      concurrency: 10,
    }
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Notification worker completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Notification worker failed');
  });

  return worker;
}
