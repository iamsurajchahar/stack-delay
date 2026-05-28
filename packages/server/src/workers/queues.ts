import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis';

const connection = createRedisConnection();

export const QUEUE_NAMES = {
  REPO_SCAN: 'repo-scan',
  DEPENDENCY_ENRICH: 'dependency-enrich',
  SCORE_COMPUTE: 'score-compute',
  ALERT_EVALUATION: 'alert-evaluation',
  NOTIFICATION_SEND: 'notification-send',
  SCHEDULED_SCAN: 'scheduled-scan',
} as const;

export const scanQueue = new Queue(QUEUE_NAMES.REPO_SCAN, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const enrichQueue = new Queue(QUEUE_NAMES.DEPENDENCY_ENRICH, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export const scoreQueue = new Queue(QUEUE_NAMES.SCORE_COMPUTE, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export const alertQueue = new Queue(QUEUE_NAMES.ALERT_EVALUATION, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION_SEND, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export const scheduledScanQueue = new Queue(QUEUE_NAMES.SCHEDULED_SCAN, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export async function addScheduledScan(repoId: string, frequency: string): Promise<void> {
  const cronMap: Record<string, string> = {
    daily: '0 6 * * *',
    weekly: '0 6 * * 1',
    monthly: '0 6 1 * *',
  };

  const pattern = cronMap[frequency];
  if (!pattern) return;

  await scheduledScanQueue.add(
    'scheduled-scan',
    { repositoryId: repoId },
    {
      repeat: { pattern },
      jobId: `scheduled-${repoId}`,
    }
  );
}

export async function removeScheduledScan(repoId: string): Promise<void> {
  const repeatableJobs = await scheduledScanQueue.getRepeatableJobs();
  const job = repeatableJobs.find((j) => j.id === `scheduled-${repoId}`);
  if (job) {
    await scheduledScanQueue.removeRepeatableByKey(job.key);
  }
}
